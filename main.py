import asyncio
import json
import struct
import time
import uuid
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"
BINARY_SEND_TIMEOUT_SECONDS = 15
INDEX_ASSET_PATHS = (
    "/static/icon.svg",
    "/static/icon-maskable.svg",
    "/static/style.css",
    "/static/app.js",
)
MANIFEST_PATH = "/static/manifest.webmanifest"
NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")
app.mount("/fonts", StaticFiles(directory=STATIC_DIR / "fonts"), name="fonts")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")



class ConnectionManager:
    def __init__(self):
        # {token: {clientId: {"control": WebSocket, "data": WebSocket, "peer_number": int}}}
        self.connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
        # {token: {clientId: {itemId: metadata}}}
        self.metadata: Dict[str, Dict[str, Dict[str, dict]]] = {}
        # {token: {itemId: encrypted manifest record}}; volatile, rebuilt by connected clients after restart
        self.manifest: Dict[str, Dict[str, dict]] = {}
        # {token: {clientId: metrics}} volatile client network/device metrics for the active room
        self.client_metrics: Dict[str, Dict[str, dict]] = {}
        # {token: {clientId: {publicKeyJwk, expiresAt}}} volatile pairing hosts
        self.pairing_hosts: Dict[str, Dict[str, dict]] = {}
        # {token: int} monotonically increasing counter so numbers never reuse after a peer leaves
        self.peer_counters: Dict[str, int] = {}

    def _peer_ip(self, ws: WebSocket):
        return ws.client.host if ws.client else None

    def _peer_number(self, token: str, client_id: str):
        return self.connections.get(token, {}).get(client_id, {}).get("peer_number", 1)

    def _peer_infos(self, token: str, exclude: str):
        return [
            {
                "clientId": cid,
                "peerNumber": entry.get("peer_number", 1),
                "ip": entry.get("ip"),
                "metrics": entry.get("metrics") or self.client_metrics.get(token, {}).get(cid, {}),
            }
            for cid, entry in self.connections.get(token, {}).items()
            if cid != exclude
        ]

    def _active_pairing_hosts(self, token: str, exclude: Optional[str] = None):
        now = int(time.time() * 1000)
        hosts = self.pairing_hosts.get(token, {})
        expired = [client_id for client_id, host in hosts.items() if int(host.get("expiresAt") or 0) <= now]
        for client_id in expired:
            hosts.pop(client_id, None)
        if not hosts:
            self.pairing_hosts.pop(token, None)
            return []
        return [
            {
                "clientId": client_id,
                "publicKeyJwk": host.get("publicKeyJwk"),
                "expiresAt": host.get("expiresAt"),
            }
            for client_id, host in hosts.items()
            if client_id != exclude
        ]

    def _sanitize_metrics(self, metrics: dict):
        if not isinstance(metrics, dict):
            return {}
        clean = {}
        device_type = metrics.get("deviceType")
        if device_type in ("mobile", "desktop"):
            clean["deviceType"] = device_type
        for key in ("pingMs", "uploadBps", "downloadBps"):
            value = metrics.get(key)
            if isinstance(value, (int, float)) and value >= 0:
                clean[key] = min(float(value), 10_000_000_000)
        updated_at = metrics.get("updatedAt")
        if isinstance(updated_at, (int, float)) and updated_at >= 0:
            clean["updatedAt"] = int(updated_at)
        return clean

    async def update_client_metrics(self, token: str, client_id: str, metrics: dict):
        clean = self._sanitize_metrics(metrics)
        if not clean:
            return
        token_metrics = self.client_metrics.setdefault(token, {})
        existing = token_metrics.get(client_id, {})
        merged = {**existing, **clean}
        token_metrics[client_id] = merged
        entry = self.connections.get(token, {}).get(client_id)
        if entry is not None:
            entry["metrics"] = merged
        await self._broadcast(token, {
            "type": "client_metrics_updated",
            "clientId": client_id,
            "metrics": merged,
        })

    async def connect(self, token: str, client_id: str, ws: WebSocket, channel: str = "control") -> bool:
        await ws.accept()
        peers = self.connections.setdefault(token, {})
        token_metadata = self.metadata.setdefault(token, {})
        self.manifest.setdefault(token, {})
        token_metrics = self.client_metrics.setdefault(token, {})
        channel = "data" if channel == "data" else "control"
        existing = peers.get(client_id)

        if channel == "data":
            if not existing:
                await ws.close()
                return False
            old_ws = existing.get("data")
            existing["data"] = ws
            try:
                if old_ws:
                    await old_ws.close()
            except Exception:
                pass
            return True

        if existing:
            # Same client reconnecting (page refresh race condition).
            # Swap the WebSocket silently so other peers don't see a leave/rejoin.
            old_ws = existing.get("control")
            existing["control"] = ws  # replace before closing so disconnect() becomes a no-op
            existing["ip"] = self._peer_ip(ws)
            try:
                if old_ws:
                    await old_ws.close()
            except Exception:
                pass
            await self._send(ws, {"type": "welcome", "clientId": client_id,
                                  "peerCount": len(peers) - 1, "encrypted": True,
                                  "peerInfos": self._peer_infos(token, client_id),
                                  "selfPeerNumber": self._peer_number(token, client_id),
                                  "clientIp": existing.get("ip"),
                                  "metrics": existing.get("metrics") or token_metrics.get(client_id, {}),
                                  "manifest": self._manifest_records(token),
                                  "pairingHosts": self._active_pairing_hosts(token, client_id),
                                  "sources": self._sync_sources(token, client_id)})
            return True

        peer_count = len(peers)
        n = self.peer_counters.get(token, 0) + 1
        self.peer_counters[token] = n
        peers[client_id] = {
            "control": ws,
            "ip": self._peer_ip(ws),
            "peer_number": n,
            "metrics": token_metrics.get(client_id, {}),
        }
        token_metadata.setdefault(client_id, {})
        token_metrics.setdefault(client_id, peers[client_id]["metrics"])
        await self._send(ws, {"type": "welcome", "clientId": client_id,
                               "peerCount": peer_count, "encrypted": True,
                               "peerInfos": self._peer_infos(token, client_id),
                               "selfPeerNumber": self._peer_number(token, client_id),
                               "clientIp": peers[client_id].get("ip"),
                               "metrics": peers[client_id].get("metrics", {}),
                               "manifest": self._manifest_records(token),
                               "pairingHosts": self._active_pairing_hosts(token, client_id),
                               "sources": self._sync_sources(token, client_id)})
        await self._broadcast(token, {
            "type": "peer_joined",
            "clientId": client_id,
            "peerNumber": self._peer_number(token, client_id),
            "ip": peers[client_id].get("ip"),
            "metrics": peers[client_id].get("metrics", {}),
        }, exclude=client_id)
        return True

    async def disconnect(self, token: str, client_id: str, ws: WebSocket, channel: str = "control"):
        peers = self.connections.get(token, {})
        entry = peers.get(client_id)
        channel = "data" if channel == "data" else "control"
        if not entry or entry.get(channel) is not ws:
            # A reconnect already replaced this WebSocket; nothing to do.
            return
        if channel == "data":
            entry.pop("data", None)
            return
        data_ws = entry.get("data")
        if data_ws:
            try:
                await data_ws.close()
            except Exception:
                pass
        peers.pop(client_id, None)
        token_metadata = self.metadata.get(token, {})
        token_metrics = self.client_metrics.get(token, {})
        token_metadata.pop(client_id, None)
        self.pairing_hosts.get(token, {}).pop(client_id, None)
        if not peers:
            self.connections.pop(token, None)
            self.metadata.pop(token, None)
            self.client_metrics.pop(token, None)
            self.peer_counters.pop(token, None)
            self.pairing_hosts.pop(token, None)
        else:
            token_metrics.pop(client_id, None)
            await self._broadcast(token, {"type": "peer_left", "clientId": client_id})

    def _sync_sources(self, token: str, exclude: str):
        grouped: Dict[str, list] = {}
        connected = self.connections.get(token, {})
        for record in self.manifest.get(token, {}).values():
            if record.get("deleted"):
                continue
            item_id = record.get("itemId")
            if not item_id:
                continue
            for holder_id in record.get("holders") or [record.get("ownerId")]:
                if not holder_id or holder_id == exclude or holder_id not in connected:
                    continue
                grouped.setdefault(holder_id, []).append({"id": item_id})
        return [
            {"clientId": client_id, "itemCount": len(items), "items": items}
            for client_id, items in grouped.items()
        ]

    def _manifest_records(self, token: str):
        return [
            record for record in self.manifest.get(token, {}).values()
            if not record.get("deleted")
        ]

    def _clean_manifest_record(self, msg: dict, owner_id: str):
        item_id = msg.get("itemId")
        if not item_id:
            return None
        revision = msg.get("revision")
        if not isinstance(revision, (int, float)):
            revision = 0
        record = {
            "itemId": str(item_id),
            "ownerId": owner_id,
            "holders": [owner_id],
            "revision": int(revision),
            "updatedAt": int(msg.get("updatedAt") or 0),
            "deleted": bool(msg.get("deleted")),
        }
        encrypted_meta = msg.get("encryptedMeta")
        if isinstance(encrypted_meta, dict) and "iv" in encrypted_meta and "ciphertext" in encrypted_meta:
            record["encryptedMeta"] = encrypted_meta
        return record

    async def _store_manifest_record(self, token: str, sender_id: str, msg: dict):
        record = self._clean_manifest_record(msg, sender_id)
        if not record:
            return
        records = self.manifest.setdefault(token, {})
        existing = records.get(record["itemId"])
        if existing and existing.get("deleted") and not record.get("deleted"):
            return
        if existing and int(existing.get("revision") or 0) > record["revision"]:
            return
        if existing and not record.get("deleted"):
            holders = set(existing.get("holders") or [])
            holders.add(sender_id)
            record["holders"] = sorted(holders)
            if not record.get("encryptedMeta") and existing.get("encryptedMeta"):
                record["encryptedMeta"] = existing["encryptedMeta"]
            record["ownerId"] = existing.get("ownerId") or sender_id
        records[record["itemId"]] = record
        await self._broadcast(token, {
            "type": "manifest_updated",
            "record": record,
            "senderId": sender_id,
        })

    async def _publish_pairing_hosts(self, token: str):
        await self._broadcast(token, {
            "type": "pairing_hosts",
            "hosts": self._active_pairing_hosts(token),
        })

    async def _store_pairing_host(self, token: str, sender_id: str, msg: dict):
        public_key = msg.get("publicKeyJwk")
        if not isinstance(public_key, dict):
            return
        now = int(time.time() * 1000)
        expires_at = msg.get("expiresAt")
        if not isinstance(expires_at, (int, float)):
            expires_at = now + 60_000
        expires_at = int(min(max(expires_at, now + 1000), now + 70_000))
        self.pairing_hosts.setdefault(token, {})[sender_id] = {
            "publicKeyJwk": public_key,
            "expiresAt": expires_at,
        }
        await self._publish_pairing_hosts(token)

    async def _stop_pairing_host(self, token: str, sender_id: str):
        hosts = self.pairing_hosts.get(token)
        if not hosts:
            return
        hosts.pop(sender_id, None)
        if not hosts:
            self.pairing_hosts.pop(token, None)
        await self._publish_pairing_hosts(token)

    def _item_metadata(self, item: dict, encrypted: bool = False):
        if not isinstance(item, dict):
            return None
        item_id = item.get("id")
        if not item_id:
            return None
        allowed = ("id", "type", "filename", "mimeType", "size", "addedAt", "encrypted", "thumbnailDataUrl")
        meta = {key: item[key] for key in allowed if key in item}
        meta["id"] = item_id
        if encrypted:
            meta["encrypted"] = True
        return meta

    def _record_payload_metadata(self, token: str, client_id: str, payload: dict, encrypted: bool = False):
        if not isinstance(payload, dict):
            return
        client_items = self.metadata.setdefault(token, {}).setdefault(client_id, {})
        payload_type = payload.get("type")
        if payload_type == "item_added":
            meta = self._item_metadata(payload.get("item"), encrypted)
            if meta:
                client_items[meta["id"]] = meta
        elif payload_type == "item_deleted":
            client_items.pop(payload.get("itemId"), None)
        elif payload_type == "item_updated":
            item_id = payload.get("itemId")
            if item_id in client_items:
                client_items[item_id]["updatedAt"] = payload.get("updatedAt")
        elif payload_type == "clear_all":
            client_items.clear()

    def _record_encrypted_metadata(self, token: str, client_id: str, msg: dict):
        meta = msg.get("meta")
        if not isinstance(meta, dict):
            return
        client_items = self.metadata.setdefault(token, {}).setdefault(client_id, {})
        if meta.get("payloadType") == "item_added" and meta.get("itemId"):
            client_items[meta["itemId"]] = {
                "id": meta["itemId"],
                "type": meta.get("itemType", "encrypted"),
                "addedAt": meta.get("addedAt"),
                "encrypted": True,
            }
        elif meta.get("payloadType") == "item_deleted":
            client_items.pop(meta.get("itemId"), None)

    def _channel_ws(self, token: str, client_id: str, channel: str):
        entry = self.connections.get(token, {}).get(client_id, {})
        return entry.get(channel)

    async def _broadcast_channel(self, token: str, msg: dict, channel: str, exclude: Optional[str] = None):
        peers = self.connections.get(token, {})
        await asyncio.gather(
            *[self._send(ws, msg) for cid in peers.keys() if cid != exclude and (ws := self._channel_ws(token, cid, channel))]
        )

    async def relay(self, token: str, sender_id: str, raw: str, channel: str = "control"):
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        if msg.get("type") == "metrics_ping":
            sender_ws = self.connections.get(token, {}).get(sender_id, {}).get("control")
            if sender_ws:
                await self._send(sender_ws, {"type": "metrics_pong", "sentAt": msg.get("sentAt")})
            return

        if msg.get("type") == "client_metrics":
            await self.update_client_metrics(token, sender_id, msg.get("metrics", {}))
            return

        if msg.get("type") == "metadata_snapshot_request":
            sender_ws = self.connections.get(token, {}).get(sender_id, {}).get("control")
            if sender_ws:
                await self._send(sender_ws, {
                    "type": "metadata_snapshot",
                    "sources": self._sync_sources(token, sender_id),
                })
            return

        if msg.get("type") == "manifest_upsert":
            await self._store_manifest_record(token, sender_id, msg)
            return

        if msg.get("type") == "manifest_delete":
            await self._store_manifest_record(token, sender_id, {
                "itemId": msg.get("itemId"),
                "revision": msg.get("revision"),
                "updatedAt": msg.get("updatedAt"),
                "deleted": True,
            })
            return

        if msg.get("type") == "pairing_mode":
            await self._store_pairing_host(token, sender_id, msg)
            return

        if msg.get("type") == "pairing_stop":
            await self._stop_pairing_host(token, sender_id)
            return

        if msg.get("type") == "pairing_request":
            request_id = msg.get("requestId")
            encrypted_pin = msg.get("encryptedPin")
            requester_public_key = msg.get("requesterPublicKeyJwk")
            target_ids = msg.get("hostIds")
            active_hosts = self._active_pairing_hosts(token, sender_id)
            allowed_hosts = {host["clientId"] for host in active_hosts}
            if isinstance(target_ids, list) and target_ids:
                host_ids = [str(host_id) for host_id in target_ids if str(host_id) in allowed_hosts]
            else:
                host_ids = list(allowed_hosts)
            if not request_id or not isinstance(encrypted_pin, dict) or not isinstance(requester_public_key, dict):
                return
            forwarded = {
                "type": "pairing_request",
                "senderId": sender_id,
                "requestId": request_id,
                "encryptedPin": encrypted_pin,
                "requesterPublicKeyJwk": requester_public_key,
            }
            await asyncio.gather(*[
                self._send(peer_ws, forwarded)
                for host_id in host_ids
                if (peer_ws := self._channel_ws(token, host_id, channel))
            ])
            return

        if msg.get("type") == "pairing_response":
            target_id = msg.get("targetId")
            request_id = msg.get("requestId")
            encrypted_passphrase = msg.get("encryptedPassphrase")
            if not target_id or not request_id or not isinstance(encrypted_passphrase, dict):
                return
            peer_ws = self._channel_ws(token, str(target_id), channel)
            if peer_ws:
                await self._send(peer_ws, {
                    "type": "pairing_response",
                    "senderId": sender_id,
                    "requestId": request_id,
                    "encryptedPassphrase": encrypted_passphrase,
                })
            return

        if msg.get("type") == "key_proof":
            proof = msg.get("proof")
            if not isinstance(proof, dict):
                return
            forwarded = {
                "type": "key_proof",
                "senderId": sender_id,
                "proof": proof,
            }
            await self._broadcast_channel(token, forwarded, channel, exclude=sender_id)
            return

        if msg.get("type") == "encrypted":
            self._record_encrypted_metadata(token, sender_id, msg)
            target_id = msg.get("targetId")
            forwarded = dict(msg)
            forwarded["senderId"] = sender_id
            if target_id:
                peer_ws = self._channel_ws(token, target_id, channel)
                if peer_ws:
                    await self._send(peer_ws, forwarded)
            else:
                await self._broadcast_channel(token, forwarded, channel, exclude=sender_id)
            return

        return

    async def relay_binary(self, token: str, sender_id: str, data: bytes):
        # Binary frame format:
        #   [4B Uint32 BE: header_len] [header_len bytes: JSON header] [remaining: chunk data]
        # Header fields: t (type), i (itemId), ci (chunkIndex), tc (totalChunks), tid (targetId, optional)
        if len(data) < 4:
            return
        header_len = struct.unpack('>I', data[:4])[0]
        if len(data) < 4 + header_len:
            return
        try:
            header = json.loads(data[4:4 + header_len].decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return
        if header.get("t") != "efc":
            return

        target_id = header.pop('tid', None)

        # Rebuild frame without targetId so relay frame is smaller
        new_header_bytes = json.dumps(header, separators=(',', ':')).encode('utf-8')
        relay_frame = struct.pack('>I', len(new_header_bytes)) + new_header_bytes + data[4 + header_len:]

        if target_id:
            entry = self.connections.get(token, {}).get(target_id, {})
            peer_ws = entry.get("data")
            if peer_ws:
                await self._send_bytes(peer_ws, relay_frame)
        else:
            await self._broadcast_bytes(token, relay_frame, exclude=sender_id)

    async def _send(self, ws: WebSocket, msg: dict):
        try:
            await ws.send_json(msg)
        except Exception:
            pass

    async def _send_bytes(self, ws: WebSocket, data: bytes):
        try:
            await asyncio.wait_for(ws.send_bytes(data), timeout=BINARY_SEND_TIMEOUT_SECONDS)
            return True
        except Exception:
            try:
                await ws.close()
            except Exception:
                pass
            return False

    async def _broadcast(self, token: str, msg: dict, exclude: Optional[str] = None):
        peers = self.connections.get(token, {})
        await asyncio.gather(
            *[self._send(entry["control"], msg) for cid, entry in peers.items() if cid != exclude and entry.get("control")]
        )

    async def _broadcast_bytes(self, token: str, data: bytes, exclude: Optional[str] = None):
        peers = self.connections.get(token, {})
        await asyncio.gather(
            *[self._send_bytes(entry["data"], data) for cid, entry in peers.items() if cid != exclude and entry.get("data")]
        )


manager = ConnectionManager()


def _asset_version(asset_path: str) -> int:
    path = STATIC_DIR.parent / asset_path.lstrip("/")
    try:
        return int(path.stat().st_mtime)
    except OSError:
        return 0


def render_index() -> HTMLResponse:
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    for asset_path in INDEX_ASSET_PATHS:
        html = html.replace(asset_path, f"{asset_path}?v={_asset_version(asset_path)}")
    html = html.replace(MANIFEST_PATH, f"/manifest.webmanifest?v={_asset_version(MANIFEST_PATH)}")
    return HTMLResponse(html, headers=NO_CACHE_HEADERS)


@app.get("/manifest.webmanifest")
async def manifest():
    manifest_data = json.loads((STATIC_DIR / "manifest.webmanifest").read_text(encoding="utf-8"))
    for icon in manifest_data.get("icons", []):
        src = icon.get("src")
        if isinstance(src, str) and src.startswith("/static/"):
            icon["src"] = f"{src}?v={_asset_version(src)}"
    return Response(
        json.dumps(manifest_data, separators=(",", ":")),
        media_type="application/manifest+json",
        headers=NO_CACHE_HEADERS,
    )


@app.get("/")
async def index():
    return render_index()


@app.get("/{token_path:path}")
async def index_with_token(token_path: str):
    return render_index()

@app.websocket("/ws/{token}")
async def websocket_endpoint(
    ws: WebSocket,
    token: str,
    clientId: Optional[str] = None,
    channel: str = "control",
):
    client_id = clientId or str(uuid.uuid4())
    channel = "data" if channel == "data" else "control"
    connected = await manager.connect(token, client_id, ws, channel)
    if not connected:
        return
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            text = msg.get('text')
            data = msg.get('bytes')
            if text and channel == "control":
                await manager.relay(token, client_id, text, channel)
            elif data and channel == "data":
                await manager.relay_binary(token, client_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(token, client_id, ws, channel)
