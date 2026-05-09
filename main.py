import asyncio
import json
import uuid
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"


class ConnectionManager:
    def __init__(self):
        # {token: {clientId: WebSocket}}
        self.connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, token: str, client_id: str, ws: WebSocket):
        await ws.accept()
        peers = self.connections.setdefault(token, {})
        peer_count = len(peers)
        peers[client_id] = ws

        await self._send(ws, {"type": "welcome", "clientId": client_id, "peerCount": peer_count})
        await self._broadcast(token, {"type": "peer_joined", "clientId": client_id}, exclude=client_id)

    async def disconnect(self, token: str, client_id: str):
        peers = self.connections.get(token, {})
        peers.pop(client_id, None)
        if not peers:
            self.connections.pop(token, None)
        else:
            await self._broadcast(token, {"type": "peer_left", "clientId": client_id})

    async def relay(self, token: str, sender_id: str, raw: str):
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        if msg.get("type") != "relay":
            return

        payload = msg.get("payload")
        target_id = msg.get("targetId")

        if target_id:
            peer_ws = self.connections.get(token, {}).get(target_id)
            if peer_ws:
                await self._send(peer_ws, {"type": "relay", "payload": payload})
        else:
            await self._broadcast(token, {"type": "relay", "payload": payload}, exclude=sender_id)

    async def _send(self, ws: WebSocket, msg: dict):
        try:
            await ws.send_json(msg)
        except Exception:
            pass

    async def _broadcast(self, token: str, msg: dict, exclude: str | None = None):
        peers = self.connections.get(token, {})
        await asyncio.gather(
            *[self._send(ws, msg) for cid, ws in peers.items() if cid != exclude]
        )


manager = ConnectionManager()


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.websocket("/ws/{token}")
async def websocket_endpoint(ws: WebSocket, token: str, clientId: str | None = None):
    client_id = clientId or str(uuid.uuid4())
    await manager.connect(token, client_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            await manager.relay(token, client_id, data)
    except WebSocketDisconnect:
        await manager.disconnect(token, client_id)
