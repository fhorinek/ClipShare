import asyncio
import json
import struct
import unittest

from main import ConnectionManager, app
from fastapi.testclient import TestClient


class Socket:
    client = None

    def __init__(self):
        self.frames = []
        self.messages = []
        self.closed = False
        self.close_started = asyncio.Event()
        self.close_gate = None

    async def accept(self):
        pass

    async def send_bytes(self, data):
        self.frames.append(data)

    async def send_json(self, data):
        self.messages.append(data)

    async def close(self):
        self.close_started.set()
        if self.close_gate:
            await self.close_gate.wait()
        self.closed = True


def frame(header, payload=b'0' * 28):
    encoded = json.dumps(header).encode()
    return struct.pack('>I', len(encoded)) + encoded + payload


class ConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_disconnect_cannot_remove_replacement(self):
        manager = ConnectionManager()
        old_control, data, replacement = Socket(), Socket(), Socket()
        data.close_gate = asyncio.Event()
        manager.connections['room'] = {'client': {'control': old_control, 'data': data}}
        disconnect = asyncio.create_task(manager.disconnect('room', 'client', old_control))
        await data.close_started.wait()
        await manager.connect('room', 'client', replacement)
        data.close_gate.set()
        await disconnect
        self.assertIs(manager.connections['room']['client']['control'], replacement)

    async def test_reconnect_during_departure_broadcast_preserves_metrics_and_peer_order(self):
        started, release = asyncio.Event(), asyncio.Event()

        class Observer(Socket):
            async def send_json(self, message):
                if message['type'] == 'manifest_updated':
                    started.set()
                    await release.wait()
                await super().send_json(message)

        manager = ConnectionManager()
        old, observer, replacement = Socket(), Observer(), Socket()
        manager.connections['room'] = {'client': {'control': old}, 'observer': {'control': observer}}
        manager.client_metrics['room'] = {'client': {'pingMs': 1}}
        manager.manifest['room'] = {'file': {'itemId': 'file', 'holders': ['client'], 'ownerId': 'client', 'revision': 1}}
        disconnect = asyncio.create_task(manager.disconnect('room', 'client', old))
        await started.wait()
        reconnect = asyncio.create_task(manager.connect('room', 'client', replacement))
        await asyncio.sleep(0)
        manager.client_metrics['room']['client'] = {'pingMs': 99}
        release.set()
        await asyncio.gather(disconnect, reconnect)
        self.assertIs(manager.connections['room']['client']['control'], replacement)
        self.assertEqual(manager.client_metrics['room']['client']['pingMs'], 99)
        self.assertEqual([message['type'] for message in observer.messages], ['manifest_updated', 'peer_left', 'peer_joined'])

    async def test_binary_sender_is_socket_identity(self):
        manager = ConnectionManager()
        receiver = Socket()
        manager.connections['room'] = {'receiver': {'data': receiver}}
        await manager.relay_binary('room', 'sender', frame({
            'v': 2, 't': 'efc', 'i': 'file', 'x': 'transfer', 'q': 'request',
            'ci': 0, 'tc': 1, 'sid': 'forged', 'rid': 'receiver', 'tid': 'receiver',
        }))
        await asyncio.gather(*(state['task'] for state in manager.binary_writers.values()))
        data = receiver.frames[0]
        length = struct.unpack('>I', data[:4])[0]
        self.assertEqual(json.loads(data[4:4 + length])['sid'], 'sender')

    async def test_non_object_binary_headers_are_ignored(self):
        manager = ConnectionManager()
        for value in [None, [], 123, 'header']:
            await manager.relay_binary('room', 'sender', frame(value))

    async def test_availability_loss_is_not_deletion(self):
        manager = ConnectionManager()
        manager.connections['room'] = {'holder': {'control': Socket()}, 'peer': {'control': Socket()}}
        await manager._store_manifest_record('room', 'holder', {
            'itemId': 'file', 'revision': 1, 'encryptedMeta': {'iv': [], 'ciphertext': []},
        })
        old = manager.connections['room']['holder']['control']
        await manager.disconnect('room', 'holder', old)
        record = manager.manifest['room']['file']
        self.assertFalse(record['deleted'])
        self.assertEqual(record['holders'], [])
        await manager.connect('room', 'holder', Socket())
        await manager._store_manifest_record('room', 'holder', {
            'itemId': 'file', 'revision': record['revision'] + 1,
            'encryptedMeta': {'iv': [], 'ciphertext': []},
        })
        self.assertEqual(manager.manifest['room']['file']['holders'], ['holder'])

    async def test_explicit_tombstone_cannot_be_replaced(self):
        manager = ConnectionManager()
        await manager._store_manifest_record('room', 'holder', {'itemId': 'file', 'revision': 10, 'deleted': True})
        await manager._store_manifest_record('room', 'holder', {'itemId': 'file', 'revision': 11, 'deleted': False})
        self.assertTrue(manager.manifest['room']['file']['deleted'])

    async def test_offline_deletion_wins_over_a_newer_holder_revision(self):
        manager = ConnectionManager()
        desktop = Socket()
        manager.connections['room'] = {'desktop': {'control': desktop}}
        await manager._store_manifest_record('room', 'desktop', {
            'itemId': 'file', 'revision': 100, 'encryptedMeta': {'iv': [], 'ciphertext': []},
        })
        await manager._store_manifest_record('room', 'phone', {
            'itemId': 'file', 'revision': 10, 'deleted': True,
        })
        record = manager.manifest['room']['file']
        self.assertTrue(record['deleted'])
        self.assertGreaterEqual(record['revision'], 100)
        self.assertEqual(record['holders'], [])
        self.assertTrue(desktop.messages[-1]['record']['deleted'])
        await manager._store_manifest_record('room', 'desktop', {
            'itemId': 'file', 'revision': 1000, 'encryptedMeta': {'iv': [], 'ciphertext': []},
        })
        self.assertTrue(manager.manifest['room']['file']['deleted'])

    async def test_reconnect_and_foreground_snapshots_include_deletions(self):
        manager = ConnectionManager()
        manager.connections['room'] = {'desktop': {'control': Socket()}}
        await manager._store_manifest_record('room', 'desktop', {'itemId': 'file', 'revision': 10, 'deleted': True})
        phone = Socket()
        await manager.connect('room', 'phone', phone)
        welcome = phone.messages[0]
        self.assertEqual(welcome['type'], 'welcome')
        self.assertTrue(welcome['manifest'][0]['deleted'])
        self.assertEqual(welcome['sources'], [])
        await manager.relay('room', 'phone', json.dumps({'type': 'metadata_snapshot_request'}))
        self.assertEqual(phone.messages[-1]['type'], 'metadata_snapshot')
        self.assertTrue(phone.messages[-1]['manifest'][0]['deleted'])

    async def test_content_timestamp_is_separate_from_holder_revisions(self):
        manager = ConnectionManager()
        manager.connections['room'] = {'desktop': {'control': Socket()}, 'phone': {'control': Socket()}}
        old_meta = {'iv': [], 'ciphertext': ['old']}
        new_meta = {'iv': [], 'ciphertext': ['new']}
        await manager._store_manifest_record('room', 'desktop', {
            'itemId': 'text', 'revision': 100, 'lastChangedAt': 10, 'lastChangedBy': 'desktop', 'encryptedMeta': old_meta,
        })
        await manager._store_manifest_record('room', 'phone', {
            'itemId': 'text', 'revision': 1, 'lastChangedAt': 20, 'lastChangedBy': 'phone', 'encryptedMeta': new_meta,
        })
        record = manager.manifest['room']['text']
        self.assertEqual(record['lastChangedAt'], 20)
        self.assertEqual(record['encryptedMeta'], new_meta)
        self.assertEqual(record['holders'], ['phone'])
        await manager._store_manifest_record('room', 'desktop', {
            'itemId': 'text', 'revision': 1000, 'lastChangedAt': 10, 'lastChangedBy': 'desktop', 'encryptedMeta': old_meta,
        })
        self.assertEqual(manager.manifest['room']['text']['encryptedMeta'], new_meta)
        await manager._store_manifest_record('room', 'desktop', {
            'itemId': 'text', 'revision': 2, 'lastChangedAt': 20, 'lastChangedBy': 'phone', 'encryptedMeta': new_meta,
        })
        self.assertEqual(manager.manifest['room']['text']['holders'], ['desktop', 'phone'])
        await manager.disconnect('room', 'phone', manager.connections['room']['phone']['control'])
        self.assertEqual(manager.manifest['room']['text']['lastChangedAt'], 20)
        await manager.connect('room', 'phone', Socket())
        await manager._store_manifest_record('room', 'phone', {
            'itemId': 'text', 'revision': 3, 'lastChangedAt': 20, 'lastChangedBy': 'phone', 'encryptedMeta': new_meta,
        })
        self.assertEqual(manager.manifest['room']['text']['lastChangedAt'], 20)
        self.assertEqual(manager.manifest['room']['text']['holders'], ['desktop', 'phone'])

    async def test_equal_timestamps_have_a_stable_writer_tiebreaker(self):
        for writers in [('a-desktop', 'z-phone'), ('z-phone', 'a-desktop')]:
            manager = ConnectionManager()
            for writer in writers:
                await manager._store_manifest_record('room', writer, {
                    'itemId': 'text', 'revision': 100, 'lastChangedAt': 20, 'lastChangedBy': writer,
                    'encryptedMeta': {'iv': [], 'ciphertext': [writer]},
                })
            self.assertEqual(manager.manifest['room']['text']['lastChangedBy'], 'z-phone')

    async def test_deletion_replay_retains_its_original_change_timestamp(self):
        manager = ConnectionManager()
        await manager.relay('room', 'phone', json.dumps({
            'type': 'manifest_delete', 'itemId': 'file', 'revision': 1, 'lastChangedAt': 20, 'lastChangedBy': 'phone',
        }))
        await manager.relay('room', 'desktop', json.dumps({
            'type': 'manifest_delete', 'itemId': 'file', 'revision': 100, 'lastChangedAt': 10, 'lastChangedBy': 'desktop',
        }))
        record = manager.manifest['room']['file']
        self.assertEqual((record['lastChangedAt'], record['lastChangedBy']), (20, 'phone'))
        self.assertEqual(record['revision'], 100)

    async def test_invalid_change_timestamps_are_rejected(self):
        manager = ConnectionManager()
        for value in [-1, True, 1.5, '20', 9007199254740992]:
            await manager._store_manifest_record('room', 'phone', {
                'itemId': 'file', 'revision': 1, 'lastChangedAt': value,
            })
        self.assertEqual(manager.manifest, {})

    async def test_bad_control_and_frame_shapes_are_ignored(self):
        manager = ConnectionManager()
        receiver = Socket()
        manager.connections['room'] = {'receiver': {'data': receiver}}
        good = {'v': 2, 't': 'efc', 'i': 'file', 'x': 'transfer', 'q': 'request',
                'ci': 0, 'tc': 1, 'sid': 'sender', 'rid': 'receiver', 'tid': 'receiver'}
        for change in [{'ci': -1}, {'ci': 1}, {'tc': 2049}, {'tc': True}, {'tid': 'other'}, {'v': 1}, {'x': ''}]:
            await manager.relay_binary('room', 'sender', frame({**good, **change}))
        for value in [None, [], 123, 'control']:
            await manager.relay('room', 'sender', json.dumps(value))
        for value in [
            {'type': 'encrypted', 'targetId': []},
            {'type': 'encrypted', 'targetId': {'id': 'receiver'}},
            {'type': 'pairing_response', 'requestId': [], 'targetId': 'receiver'},
            {'type': 'manifest_upsert', 'itemId': [], 'revision': 1},
            {'type': 'client_metrics', 'metrics': {'updatedAt': float('inf'), 'pingMs': float('nan')}},
            {'type': 'pairing_mode', 'pairingVersion': 'speke-v1', 'pinId': 'pin', 'expiresAt': float('nan')},
        ]:
            await manager.relay('room', 'sender', json.dumps(value))
        self.assertEqual(receiver.frames, [])

    async def test_slow_recipient_does_not_block_other_recipients(self):
        gate = asyncio.Event()

        class Slow(Socket):
            async def send_bytes(self, data):
                await gate.wait()
                await super().send_bytes(data)

        manager = ConnectionManager()
        slow, fast = Slow(), Socket()
        manager.connections['room'] = {'slow': {'data': slow}, 'fast': {'data': fast}}
        header = {'v': 2, 't': 'efc', 'i': 'file', 'x': 'transfer', 'q': 'request', 'ci': 0, 'tc': 1, 'sid': 'sender'}
        await manager.relay_binary('room', 'sender', frame({**header, 'rid': 'slow', 'tid': 'slow'}))
        await manager.relay_binary('room', 'sender', frame({**header, 'rid': 'fast', 'tid': 'fast'}))
        await asyncio.wait_for(manager.binary_writers[fast]['task'], 1)
        self.assertEqual(len(fast.frames), 1)
        self.assertEqual(slow.frames, [])
        gate.set()
        await asyncio.gather(*(state['task'] for state in manager.binary_writers.values()))


class ProtocolTests(unittest.TestCase):
    def test_old_and_invalid_versions_require_refresh(self):
        with TestClient(app) as client:
            for version in ['', '&protocolVersion=1', '&protocolVersion=nope']:
                with client.websocket_connect('/ws/test?clientId=client' + version) as ws:
                    self.assertEqual(ws.receive_json(), {'type': 'refresh_required', 'protocolVersion': 2})
                    self.assertEqual(ws.receive()['code'], 1008)

    def test_control_and_data_connections_accept_v2(self):
        with TestClient(app) as client:
            with client.websocket_connect('/ws/test?clientId=client&protocolVersion=2') as ws:
                self.assertEqual(ws.receive_json()['type'], 'welcome')
                with client.websocket_connect('/ws/test?clientId=client&channel=data&protocolVersion=2') as data:
                    data.send_bytes(b'bad')
                ws.send_text(json.dumps({'type': 'metadata_snapshot_request'}))
                self.assertIn('manifest', ws.receive_json())

    def test_new_asset_is_versioned(self):
        with TestClient(app) as client:
            response = client.get('/')
            self.assertIn('/static/transfer-core.js?v=', response.text)
            self.assertLess(response.text.index('transfer-core.js'), response.text.index('app.js'))


if __name__ == '__main__':
    unittest.main()
