import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
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
PAIRING_REQUEST_MIN_INTERVAL_MS = 5_000
PAIRING_MAX_UNUSED_PINS = 5
PAIRING_PIN_TIMEOUT_MS = 60_000
INDEX_ASSET_PATHS = (
    "/static/icon.svg",
    "/static/icon-maskable.svg",
    "/static/style.css",
    "/static/app.js",
)
MANIFEST_PATH = "/static/manifest.webmanifest"
WEBRTC_ICE_SERVERS_ENV = "WEBRTC_ICE_SERVERS_JSON"
TURN_ENV_PATH = STATIC_DIR.parent / ".turn.env"
TURN_CREDENTIAL_TTL_SECONDS = 3600
NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")
app.mount("/fonts", StaticFiles(directory=STATIC_DIR / "fonts"), name="fonts")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

logger = logging.getLogger("uvicorn.error")


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
        # {token: {clientId: {pairingVersion, pinId, expiresAt, unusedPins, currentPinUsed}}} volatile pairing host
        self.pairing_hosts: Dict[str, Dict[str, dict]] = {}
        # {token: {clientId: {pinId, unusedPins, currentPinUsed}}} survives host expiry while pairing mode rotates
        self.pairing_pin_limits: Dict[str, Dict[str, dict]] = {}
        # {token: {clientId: lastRequestAtMs}} volatile per-client pairing request rate limit
        self.pairing_request_times: Dict[str, Dict[str, int]] = {}
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
        active_hosts = [
            {
                "clientId": client_id,
                "peerNumber": self._peer_number(token, client_id),
                "pairingVersion": host.get("pairingVersion", "speke-v1"),
                "expiresAt": host.get("expiresAt"),
                "pairingWindowExpiresAt": host.get("pairingWindowExpiresAt") or host.get("expiresAt"),
                "unusedPins": int(host.get("unusedPins") or 0),
                "maxUnusedPins": PAIRING_MAX_UNUSED_PINS,
                "pinTimeoutMs": PAIRING_PIN_TIMEOUT_MS,
            }
            for client_id, host in hosts.items()
            if client_id != exclude
        ]
        return active_hosts[:1]

    def _current_pairing_host_id(self, token: str):
        hosts = self._active_pairing_hosts(token)
        return hosts[0]["clientId"] if hosts else None

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
        token_pairing_requests = self.pairing_request_times.get(token, {})
        token_metadata.pop(client_id, None)
        disconnected_pairing_host = self.pairing_hosts.get(token, {}).pop(client_id, None)
        self.pairing_pin_limits.get(token, {}).pop(client_id, None)
        if disconnected_pairing_host:
            logger.info(
                "pairing host left token=%s clientId=%s peerNumber=%s reason=disconnect",
                token, client_id, self._peer_number(token, client_id),
            )
        token_pairing_requests.pop(client_id, None)
        if not peers:
            self.connections.pop(token, None)
            self.metadata.pop(token, None)
            self.manifest.pop(token, None)
            self.client_metrics.pop(token, None)
            self.peer_counters.pop(token, None)
            self.pairing_hosts.pop(token, None)
            self.pairing_pin_limits.pop(token, None)
            self.pairing_request_times.pop(token, None)
        else:
            await self._remove_manifest_holder(token, client_id)
            token_metrics.pop(client_id, None)
            await self._broadcast(token, {"type": "peer_left", "clientId": client_id})
            if disconnected_pairing_host:
                await self._publish_pairing_hosts(token)

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

    async def _remove_manifest_holder(self, token: str, client_id: str):
        records = self.manifest.get(token)
        if not records:
            return
        now = int(time.time() * 1000)
        updates = []
        for item_id, existing in list(records.items()):
            if existing.get("deleted"):
                continue
            holders = set(existing.get("holders") or [existing.get("ownerId")])
            holders.discard(None)
            if client_id not in holders and existing.get("ownerId") != client_id:
                continue
            holders.discard(client_id)
            revision = max(now, int(existing.get("revision") or 0) + 1)
            updated = dict(existing)
            updated["revision"] = revision
            updated["updatedAt"] = now
            if holders:
                updated["holders"] = sorted(holders)
                if updated.get("ownerId") == client_id:
                    updated["ownerId"] = updated["holders"][0]
            else:
                updated["holders"] = []
                updated["deleted"] = True
            records[item_id] = updated
            updates.append(updated)
        for record in updates:
            await self._broadcast(token, {
                "type": "manifest_updated",
                "record": record,
                "senderId": client_id,
            })

    async def _publish_pairing_hosts(self, token: str):
        await self._broadcast(token, {
            "type": "pairing_hosts",
            "hosts": self._active_pairing_hosts(token),
        })

    async def _store_pairing_host(self, token: str, sender_id: str, msg: dict):
        if msg.get("pairingVersion") != "speke-v1":
            return
        pin_id = msg.get("pinId")
        if not pin_id:
            return
        now = int(time.time() * 1000)
        current_host_id = self._current_pairing_host_id(token)
        if current_host_id and current_host_id != sender_id:
            sender_ws = self._channel_ws(token, sender_id, "control")
            if sender_ws:
                await self._send(sender_ws, {
                    "type": "pairing_rejected",
                    "reason": "active_pairing_host",
                    "activeHostId": current_host_id,
                    "activeHostPeerNumber": self._peer_number(token, current_host_id),
                    "retryAfterMs": max(0, int(self.pairing_hosts[token][current_host_id].get("expiresAt") or now) - now),
                    "pairingWindowRetryAfterMs": max(0, int(self.pairing_hosts[token][current_host_id].get("pairingWindowExpiresAt") or now) - now),
                })
            return
        token_limits = self.pairing_pin_limits.setdefault(token, {})
        limit_state = token_limits.get(sender_id, {})
        unused_pins = int(limit_state.get("unusedPins") or 0)
        current_pin_used = bool(limit_state.get("currentPinUsed"))
        old_pin_id = limit_state.get("pinId")
        window_expires_at = int(limit_state.get("pairingWindowExpiresAt") or (now + PAIRING_MAX_UNUSED_PINS * PAIRING_PIN_TIMEOUT_MS))
        if old_pin_id and old_pin_id != pin_id and current_pin_used:
            unused_pins = 0
            window_expires_at = now + PAIRING_MAX_UNUSED_PINS * PAIRING_PIN_TIMEOUT_MS
        if old_pin_id and old_pin_id != pin_id and not current_pin_used:
            unused_pins += 1
            window_expires_at = min(window_expires_at, now + max(1, PAIRING_MAX_UNUSED_PINS - unused_pins) * PAIRING_PIN_TIMEOUT_MS)
            if unused_pins >= PAIRING_MAX_UNUSED_PINS:
                self.pairing_hosts.pop(token, None)
                token_limits.pop(sender_id, None)
                sender_ws = self._channel_ws(token, sender_id, "control")
                if sender_ws:
                    await self._send(sender_ws, {
                        "type": "pairing_host_removed",
                        "reason": "unused_pin_limit",
                        "maxUnusedPins": PAIRING_MAX_UNUSED_PINS,
                    })
                logger.info(
                    "pairing host removed after unused PIN limit token=%s clientId=%s peerNumber=%s unusedPins=%s",
                    token, sender_id, self._peer_number(token, sender_id), unused_pins,
                )
                await self._publish_pairing_hosts(token)
                return
        token_limits[sender_id] = {
            "pinId": str(pin_id),
            "unusedPins": unused_pins,
            "currentPinUsed": current_pin_used if old_pin_id == pin_id else False,
            "pairingWindowExpiresAt": window_expires_at,
        }
        existing = self.pairing_hosts.get(token, {}).get(sender_id)
        is_new_host = not old_pin_id
        expires_at = msg.get("expiresAt")
        if not isinstance(expires_at, (int, float)):
            expires_at = now + PAIRING_PIN_TIMEOUT_MS
        expires_at = int(min(max(expires_at, now + 1000), now + PAIRING_PIN_TIMEOUT_MS + 10_000))
        if is_new_host:
            logger.info(
                "pairing host registered token=%s clientId=%s peerNumber=%s expiresAt=%s",
                token, sender_id, self._peer_number(token, sender_id), expires_at,
            )
        self.pairing_hosts[token] = {
            sender_id: {
                "pairingVersion": "speke-v1",
                "pinId": str(pin_id),
                "expiresAt": expires_at,
                "pairingWindowExpiresAt": max(window_expires_at, expires_at),
                "unusedPins": unused_pins,
            }
        }
        await self._publish_pairing_hosts(token)

    async def _stop_pairing_host(self, token: str, sender_id: str):
        hosts = self.pairing_hosts.get(token)
        if not hosts:
            self.pairing_pin_limits.get(token, {}).pop(sender_id, None)
            return
        stopped_host = hosts.pop(sender_id, None)
        self.pairing_pin_limits.get(token, {}).pop(sender_id, None)
        if stopped_host:
            logger.info(
                "pairing host left token=%s clientId=%s peerNumber=%s reason=stop",
                token, sender_id, self._peer_number(token, sender_id),
            )
        if not hosts:
            self.pairing_hosts.pop(token, None)
        await self._publish_pairing_hosts(token)

    def _pairing_request_retry_after_ms(self, token: str, sender_id: str):
        now = int(time.time() * 1000)
        token_limits = self.pairing_request_times.setdefault(token, {})
        last_request_at = int(token_limits.get(sender_id) or 0)
        retry_after = PAIRING_REQUEST_MIN_INTERVAL_MS - (now - last_request_at)
        if retry_after > 0:
            return retry_after
        token_limits[sender_id] = now
        return 0

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
            pake_start = msg.get("pakeStart")
            target_ids = msg.get("hostIds")
            if not request_id or not isinstance(pake_start, dict):
                return
            active_hosts = self._active_pairing_hosts(token, sender_id)
            allowed_hosts = {host["clientId"] for host in active_hosts}
            if isinstance(target_ids, list) and target_ids:
                host_ids = [str(host_id) for host_id in target_ids if str(host_id) in allowed_hosts]
            else:
                host_ids = list(allowed_hosts)
            if not host_ids:
                return
            retry_after_ms = self._pairing_request_retry_after_ms(token, sender_id)
            if retry_after_ms > 0:
                sender_ws = self._channel_ws(token, sender_id, channel)
                if sender_ws:
                    await self._send(sender_ws, {
                        "type": "pairing_rate_limited",
                        "retryAfterMs": retry_after_ms,
                    })
                return
            forwarded = {
                "type": "pairing_request",
                "senderId": sender_id,
                "requestId": request_id,
                "pakeStart": pake_start,
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
            pake_finish = msg.get("pakeFinish")
            if not target_id or not request_id or not isinstance(encrypted_passphrase, dict):
                return
            peer_ws = self._channel_ws(token, str(target_id), channel)
            if peer_ws:
                forwarded = {
                    "type": "pairing_response",
                    "senderId": sender_id,
                    "requestId": request_id,
                    "encryptedPassphrase": encrypted_passphrase,
                }
                if isinstance(pake_finish, dict):
                    forwarded["pakeFinish"] = pake_finish
                await self._send(peer_ws, forwarded)
            return

        if msg.get("type") == "pairing_confirm":
            target_id = msg.get("targetId")
            request_id = msg.get("requestId")
            if not target_id or not request_id:
                return
            host_record = self.pairing_hosts.get(token, {}).get(str(target_id))
            limit_state = self.pairing_pin_limits.get(token, {}).get(str(target_id))
            if host_record is not None:
                if limit_state is not None:
                    limit_state["currentPinUsed"] = True
                    limit_state["unusedPins"] = 0
                logger.info(
                    "new device paired token=%s hostClientId=%s hostPeerNumber=%s joinedClientId=%s joinedPeerNumber=%s requestId=%s",
                    token,
                    str(target_id),
                    self._peer_number(token, str(target_id)),
                    sender_id,
                    self._peer_number(token, sender_id),
                    request_id,
                )
            peer_ws = self._channel_ws(token, str(target_id), channel)
            if peer_ws:
                await self._send(peer_ws, {
                    "type": "pairing_confirm",
                    "senderId": sender_id,
                    "requestId": request_id,
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


def _turn_env() -> dict:
    try:
        lines = TURN_ENV_PATH.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    values = {}
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def _turn_ice_servers_from_env_file() -> list:
    values = _turn_env()
    host = values.get("TURN_HOST")
    port = values.get("TURN_PORT") or "3478"
    if not host:
        return []
    secret = values.get("TURN_AUTH_SECRET")
    if secret:
        username = str(int(time.time()) + TURN_CREDENTIAL_TTL_SECONDS)
        digest = hmac.new(secret.encode("utf-8"), username.encode("utf-8"), hashlib.sha1).digest()
        credential = base64.b64encode(digest).decode("ascii")
    else:
        username = values.get("TURN_USERNAME")
        credential = values.get("TURN_PASSWORD")
        if not username or not credential:
            return []
    return [
        {"urls": [f"stun:{host}:{port}"]},
        {
            "urls": [
                f"turn:{host}:{port}?transport=udp",
                f"turn:{host}:{port}?transport=tcp",
            ],
            "username": username,
            "credential": credential,
        },
    ]


def webrtc_config_payload() -> dict:
    raw = os.environ.get(WEBRTC_ICE_SERVERS_ENV, "").strip()
    if not raw:
        return {"iceServers": _turn_ice_servers_from_env_file()}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("%s is not valid JSON; serving empty WebRTC ICE config", WEBRTC_ICE_SERVERS_ENV)
        return {"iceServers": []}
    ice_servers = parsed.get("iceServers") if isinstance(parsed, dict) else parsed
    if not isinstance(ice_servers, list):
        logger.warning("%s must be a JSON array or object with iceServers array", WEBRTC_ICE_SERVERS_ENV)
        return {"iceServers": []}
    return {"iceServers": ice_servers}


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


@app.get("/webrtc-config")
async def webrtc_config():
    return Response(
        json.dumps(webrtc_config_payload(), separators=(",", ":")),
        media_type="application/json",
        headers=NO_CACHE_HEADERS,
    )


@app.get("/pairing-hosts/{token_path:path}")
async def pairing_hosts(token_path: str):
    return Response(
        json.dumps({"hosts": manager._active_pairing_hosts(token_path)}, separators=(",", ":")),
        media_type="application/json",
        headers=NO_CACHE_HEADERS,
    )


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
