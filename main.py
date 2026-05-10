import asyncio
import json
import struct
import uuid
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"

app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")
app.mount("/fonts", StaticFiles(directory=STATIC_DIR / "fonts"), name="fonts")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")



class ConnectionManager:
    def __init__(self):
        # {token: {clientId: {"control": WebSocket, "data": WebSocket, "peer_number": int}}}
        self.connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
        # {token: {clientId: {itemId: metadata}}}
        self.metadata: Dict[str, Dict[str, Dict[str, dict]]] = {}
        # {token: int} monotonically increasing counter so numbers never reuse after a peer leaves
        self.peer_counters: Dict[str, int] = {}

    def _peer_ip(self, ws: WebSocket):
        return ws.client.host if ws.client else None

    def _peer_number(self, token: str, client_id: str):
        return self.connections.get(token, {}).get(client_id, {}).get("peer_number", 1)

    def _peer_infos(self, token: str, exclude: str):
        return [
            {"clientId": cid, "peerNumber": entry.get("peer_number", 1), "ip": entry.get("ip")}
            for cid, entry in self.connections.get(token, {}).items()
            if cid != exclude
        ]

    async def connect(self, token: str, client_id: str, ws: WebSocket, channel: str = "control") -> bool:
        await ws.accept()
        peers = self.connections.setdefault(token, {})
        token_metadata = self.metadata.setdefault(token, {})
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
                                  "peerCount": len(peers) - 1, "encrypted": False,
                                  "peerInfos": self._peer_infos(token, client_id),
                                  "selfPeerNumber": self._peer_number(token, client_id),
                                  "clientIp": existing.get("ip"),
                                  "sources": self._sync_sources(token, client_id)})
            return True

        peer_count = len(peers)
        n = self.peer_counters.get(token, 0) + 1
        self.peer_counters[token] = n
        peers[client_id] = {"control": ws, "ip": self._peer_ip(ws), "peer_number": n}
        token_metadata.setdefault(client_id, {})
        await self._send(ws, {"type": "welcome", "clientId": client_id,
                               "peerCount": peer_count, "encrypted": False,
                               "peerInfos": self._peer_infos(token, client_id),
                               "selfPeerNumber": self._peer_number(token, client_id),
                               "clientIp": peers[client_id].get("ip"),
                               "sources": self._sync_sources(token, client_id)})
        await self._broadcast(token, {
            "type": "peer_joined",
            "clientId": client_id,
            "peerNumber": self._peer_number(token, client_id),
            "ip": peers[client_id].get("ip"),
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
        token_metadata.pop(client_id, None)
        if not peers:
            self.connections.pop(token, None)
            self.metadata.pop(token, None)
            self.peer_counters.pop(token, None)
        else:
            await self._broadcast(token, {"type": "peer_left", "clientId": client_id})

    def _sync_sources(self, token: str, exclude: str):
        sources = []
        for client_id, items in self.metadata.get(token, {}).items():
            if client_id == exclude or not items:
                continue
            sources.append({
                "clientId": client_id,
                "itemCount": len(items),
                "items": list(items.values()),
            })
        return sources

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

        if msg.get("type") == "metadata_snapshot_request":
            sender_ws = self.connections.get(token, {}).get(sender_id, {}).get("control")
            if sender_ws:
                await self._send(sender_ws, {
                    "type": "metadata_snapshot",
                    "sources": self._sync_sources(token, sender_id),
                })
            return

        if msg.get("type") == "metadata_update":
            action = msg.get("action", "upsert")
            client_items = self.metadata.setdefault(token, {}).setdefault(sender_id, {})
            stored = False
            item_id = msg.get("itemId")
            meta = None
            if action == "delete":
                client_items.pop(item_id, None)
                stored = True
            elif action == "clear":
                client_items.clear()
                stored = True
            else:
                meta = self._item_metadata(msg.get("item"), bool(msg.get("encrypted")))
                if meta:
                    client_items[meta["id"]] = meta
                    item_id = meta["id"]
                    stored = True
            await self._broadcast(token, {
                "type": "metadata_updated",
                "action": action,
                "itemId": item_id,
                "item": meta,
                "stored": stored,
                "senderId": sender_id,
            })
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

        if msg.get("type") != "relay":
            return

        payload = msg.get("payload")
        target_id = msg.get("targetId")
        self._record_payload_metadata(token, sender_id, payload)

        if target_id:
            peer_ws = self._channel_ws(token, target_id, channel)
            if peer_ws:
                await self._send(peer_ws, {"type": "relay", "payload": payload, "senderId": sender_id})
        else:
            await self._broadcast_channel(token, {"type": "relay", "payload": payload, "senderId": sender_id}, channel, exclude=sender_id)

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
            await ws.send_bytes(data)
        except Exception:
            pass

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


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/{token_path:path}")
async def index_with_token(token_path: str):
    return FileResponse(STATIC_DIR / "index.html")

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
            if text:
                await manager.relay(token, client_id, text, channel)
            elif data:
                await manager.relay_binary(token, client_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(token, client_id, ws, channel)
