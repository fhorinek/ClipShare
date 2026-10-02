const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../static/transfer-core.js');
const { webcrypto } = require('node:crypto');
const { ChunkScheduler, geometry, assemble, encodeFrame, decodeFrame, frameAAD, CHUNK_SIZE, MAX_FILE_BYTES } = core;
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const meta = size => ({ id: 'file-1', type: 'file', size, filename: 'sample.bin' });
const header = { v: 2, t: 'efc', i: 'file-1', x: 'transfer-1', q: 'request-1', ci: 0, tc: 1, sid: 'sender', rid: 'receiver', tid: 'receiver' };

test('scheduler retains a job inserted while the active job awaits', async () => {
  const gate = deferred();
  const order = [];
  const scheduler = new ChunkScheduler({ delay: async () => {} });
  scheduler.enqueue('first', 100, () => (async function* () { await gate.promise; order.push('first'); })());
  scheduler.enqueue('second', -100, () => (async function* () { order.push('second'); })());
  gate.resolve(); await flush();
  assert.deepEqual(order, ['first', 'second']);
  assert.equal(scheduler.hasPending(), false);
});

test('scheduler removes the failed job by identity and reports its failure', async () => {
  const gate = deferred(); const errors = [], order = [];
  const scheduler = new ChunkScheduler({ delay: async () => {}, onError: e => errors.push(e.message) });
  scheduler.enqueue('first', 1, () => (async function* () { await gate.promise; throw Error('failed'); })());
  scheduler.enqueue('second', 0, () => (async function* () { order.push('second'); })());
  gate.resolve(); await flush();
  assert.deepEqual(order, ['second']); assert.deepEqual(errors, ['failed']);
});

test('scheduler is fair across jobs and cancels in-flight work', async () => {
  const gate = deferred(), order = [];
  const scheduler = new ChunkScheduler({ delay: async () => {} });
  scheduler.enqueue('a', 0, signal => (async function* () {
    await gate.promise;
    if (signal.aborted) return;
    order.push('a1'); yield; order.push('a2'); yield;
  })());
  scheduler.enqueue('b', 0, () => (async function* () { order.push('b1'); yield; order.push('b2'); yield; })());
  gate.resolve(); await flush();
  assert.deepEqual(order, ['a1', 'b1', 'a2', 'b2']);
  const next = deferred();
  scheduler.enqueue('cancel', 0, signal => (async function* () { await next.promise; if (!signal.aborted) order.push('bad'); })());
  scheduler.cancelItem('cancel'); next.resolve(); await flush();
  assert.equal(order.includes('bad'), false);
});

test('geometry validates the boundary, empty file, and fixed chunk layout', () => {
  assert.equal(geometry(meta(0)).totalChunks, 1);
  assert.equal(geometry(meta(MAX_FILE_BYTES)).totalChunks, 2048);
  for (const size of [-1, 1.5, MAX_FILE_BYTES + 1, '10']) assert.equal(geometry(meta(size)), null);
  assert.equal(geometry({ ...meta(1), totalChunks: 2 }), null);
  assert.equal(geometry({ ...meta(1), chunkSize: 1024 }), null);
  assert.equal(geometry({ ...meta(1), mimeType: {} }), null);
  assert.equal(geometry({ ...meta(1), filename: [] }), null);
  for (const time of [-1, 1.5, Infinity, '100', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(geometry({ ...meta(1), lastChangedAt: time }), null);
  }
  assert.equal(geometry({ ...meta(1), lastChangedBy: {} }), null);
  assert.equal(geometry({ ...meta(1), rawBuffer: {}, dataUrl: 'local' }).rawBuffer, undefined);
});

test('assembly validates count and exact byte lengths including the final chunk', () => {
  assert.equal(assemble(meta(0), [new ArrayBuffer(0)]).byteLength, 0);
  assert.equal(assemble(meta(CHUNK_SIZE + 1), [new ArrayBuffer(CHUNK_SIZE), new ArrayBuffer(1)]).byteLength, CHUNK_SIZE + 1);
  assert.throws(() => assemble(meta(100), [new ArrayBuffer(1)]));
  assert.throws(() => assemble(meta(100), new Array(1)));
  assert.throws(() => assemble(meta(CHUNK_SIZE + 1), [new ArrayBuffer(CHUNK_SIZE)]));
  assert.throws(() => assemble(meta(CHUNK_SIZE), [new ArrayBuffer(CHUNK_SIZE - 1), new ArrayBuffer(1)]));
});

test('frame round trip and routing removal preserve authenticated fields', () => {
  const frame = encodeFrame(header, new Uint8Array(28));
  assert.deepEqual(decodeFrame(frame.buffer).header, header);
  const { tid, ...relayed } = header;
  assert.deepEqual(frameAAD(header), frameAAD(relayed));
  assert.notDeepEqual(frameAAD(header), frameAAD({ ...header, ci: 1 }));
});

test('malformed frame headers and payload bounds are rejected', () => {
  for (const invalid of [null, [], 123, { ...header, ci: -1 }, { ...header, tc: 2049 }, { ...header, rid: '' }, { ...header, tid: 'other' }]) {
    const data = new TextEncoder().encode(JSON.stringify(invalid));
    const bytes = new Uint8Array(data.length + 32);
    new DataView(bytes.buffer).setUint32(0, data.length); bytes.set(data, 4);
    assert.equal(decodeFrame(bytes.buffer), null);
  }
  assert.equal(decodeFrame(new ArrayBuffer(3)), null);
  assert.throws(() => encodeFrame(header, new Uint8Array(27)));
  assert.throws(() => encodeFrame(header, new Uint8Array(CHUNK_SIZE + 29)));
});

class Clock {
  constructor() { this.time = 0; this.next = 0; this.timers = new Map(); }
  set = (fn, ms) => { const id = ++this.next; this.timers.set(id, { fn, at: this.time + ms }); return id; };
  clear = id => this.timers.delete(id);
  tick(ms) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at; this.timers.delete(next[0]); next[1].fn();
    }
    this.time = end;
  }
}

async function settle(predicate, message = 'network settles') {
  for (let i = 0; i < 2000; i++) { if (predicate()) return; await flush(); }
  assert.fail(message);
}

async function network() {
  const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const net = { clients: new Map(), messages: [], frames: [], delayed: [], clock: new Clock(), dropControl: () => false, dropFrame: () => false };
  net.add = (id, overrides = {}) => {
    const items = new Map(), failures = [], snapshots = [];
    const client = new core.TransferCoordinator({
      clientId: id, crypto: webcrypto, getItem: itemId => items.get(itemId), getKey: () => key,
      now: () => net.clock.time, setTimer: net.clock.set, clearTimer: net.clock.clear, delay: flush,
      sendControl: (peerId, payload, live) => {
        if (!live()) return false;
        net.messages.push({ from: id, to: peerId, payload });
        if (!net.dropControl(id, peerId, payload)) queueMicrotask(() => net.clients.get(peerId)?.coordinator.handleControl(payload, id));
        return true;
      },
      sendFrame: async (peerId, frame, live) => {
        if (!live()) return { status: 'failed' };
        net.frames.push({ from: id, to: peerId, frame });
        if (!net.dropFrame(id, peerId, frame)) await net.clients.get(peerId)?.coordinator.acceptFrame(frame.buffer, 'webrtc', id);
        return { status: 'sent', transport: 'webrtc' };
      },
      commitFile: async (metadata, buffer, live) => {
        if (!live()) return false;
        items.set(metadata.id, { ...metadata, rawBuffer: buffer }); return true;
      },
      onFailure: (itemId, reason) => { failures.push(reason); items.delete(itemId); },
      onIncoming: record => snapshots.push({ state: record.state, received: record.received, total: record.totalChunks }),
      ...overrides,
    });
    const host = { coordinator: client, items, failures, snapshots };
    net.clients.set(id, host); client.connectionChanged(true, true); return host;
  };
  net.key = key;
  return net;
}

test('duplicate discovery downloads once and completes only after validated assembly', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  const bytes = new Uint8Array(CHUNK_SIZE + 5); bytes.fill(73);
  source.items.set('file-1', { ...meta(bytes.length), rawBuffer: bytes.buffer });
  target.coordinator.ensureAvailable(meta(bytes.length), ['source']);
  target.coordinator.ensureAvailable(meta(bytes.length), ['source']);
  await settle(() => target.items.has('file-1'));
  assert.deepEqual(new Uint8Array(target.items.get('file-1').rawBuffer), bytes);
  assert.equal(net.messages.filter(m => m.payload.type === 'file_request').length, 1);
  await settle(() => source.coordinator.outgoing.get('file-1')?.get('target')?.complete);
  assert.equal(source.coordinator.outgoing.get('file-1').get('target').transport, 'webrtc');
});

test('file content timestamps survive transfer and holder discovery unchanged', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  const metadata = { ...meta(1), lastChangedAt: 123456789, lastChangedBy: 'original-writer' };
  source.items.set(metadata.id, { ...metadata, rawBuffer: new Uint8Array([42]).buffer });
  target.coordinator.ensureAvailable(metadata, ['source']);
  await settle(() => target.items.has(metadata.id));
  assert.deepEqual(core.contentVersion(target.items.get(metadata.id)), core.contentVersion(metadata));
  target.coordinator.ensureAvailable(metadata, ['source']);
  assert.deepEqual(core.contentVersion(source.items.get(metadata.id)), core.contentVersion(metadata));
  const third = net.add('third');
  third.coordinator.ensureAvailable(metadata, ['target']);
  await settle(() => third.items.has(metadata.id));
  assert.deepEqual(core.contentVersion(third.items.get(metadata.id)), core.contentVersion(metadata));
  assert.deepEqual([...new Uint8Array(third.items.get(metadata.id).rawBuffer)], [42]);
});

test('chunks preceding metadata are retained and not prematurely completed', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([9]).buffer });
  net.dropControl = (from, to, payload) => {
    if (payload.type === 'file_metadata') { net.delayed.push({ from, to, payload }); return true; }
    return false;
  };
  target.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => target.coordinator.incoming.get('file-1')?.received === 1);
  assert.equal(target.items.has('file-1'), false);
  const response = net.delayed[0]; target.coordinator.handleControl(response.payload, response.from);
  await settle(() => target.items.has('file-1'));
  assert.deepEqual([...new Uint8Array(target.items.get('file-1').rawBuffer)], [9]);
});

test('a 16 chunk batch never implies acknowledgement of other chunks', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  const size = CHUNK_SIZE * 64;
  source.items.set('file-1', { ...meta(size), rawBuffer: new ArrayBuffer(size) });
  net.dropFrame = () => true;
  target.coordinator.ensureAvailable(meta(size), ['source']);
  await settle(() => net.frames.length === 16);
  const progress = source.coordinator.outgoing.get('file-1').get('target');
  assert.equal(progress.ackedChunks.size, 0); assert.equal(progress.sent, 0); assert.equal(progress.complete, false);
  assert.equal(net.messages.find(m => m.payload.type === 'file_request').payload.chunkIndexes.length, 16);
});

test('large-file rounded progress never disables recovery', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  net.dropControl = () => true;
  const record = target.coordinator.ensureAvailable(meta(MAX_FILE_BYTES), ['source']);
  record.received = 2038;
  record.chunks.fill(new ArrayBuffer(CHUNK_SIZE), 0, 2038);
  assert.ok(record.timer);
  net.clock.tick(2000);
  const request = net.messages.filter(m => m.payload.type === 'file_request').at(-1).payload;
  assert.deepEqual(request.chunkIndexes, Array.from({ length: 10 }, (_, i) => 2038 + i));
  assert.notEqual(record.state, 'complete'); assert.ok(record.timer);
});

test('receiver rotates sources after three attempts and preserves accepted chunks', async () => {
  const net = await network(), bad = net.add('bad'), good = net.add('good'), target = net.add('target');
  const bytes = new Uint8Array([1, 2, 3]);
  for (const host of [bad, good]) host.items.set('file-1', { ...meta(3), rawBuffer: bytes.buffer });
  net.dropFrame = from => from === 'bad';
  target.coordinator.ensureAvailable(meta(3), ['bad', 'good']);
  await settle(() => net.frames.length > 0);
  for (let i = 0; i < 3; i++) { net.clock.tick(2000); await flush(); }
  await settle(() => target.items.has('file-1'));
  assert.deepEqual(new Uint8Array(target.items.get('file-1').rawBuffer), bytes);
  assert.equal(target.coordinator.incoming.get('file-1').senderId, 'good');
});

test('exhaustion fails once; authoritative source loss removes unfinished data', async () => {
  const net = await network(), target = net.add('target');
  net.dropControl = () => true;
  target.coordinator.ensureAvailable(meta(1), ['absent']);
  net.clock.tick(6000);
  assert.deepEqual(target.failures, ['unresponsive']);
  assert.equal(target.coordinator.incoming.size, 0);
  assert.equal(target.coordinator.ensureAvailable(meta(1), ['absent']), null);
  assert.deepEqual(target.failures, ['unresponsive']);
  target.coordinator.peerDisconnected('absent');
  target.coordinator.ensureAvailable(meta(1), ['absent']);
  target.coordinator.peerDisconnected('absent');
  assert.deepEqual(target.failures, ['unresponsive', 'interrupted']);
});

test('local disconnection pauses recovery until authoritative sources return', async () => {
  const net = await network(), target = net.add('target');
  net.dropControl = () => true;
  const record = target.coordinator.ensureAvailable(meta(1), ['source']);
  target.coordinator.connectionChanged(false);
  target.coordinator.setSources('file-1', []);
  net.clock.tick(10000);
  assert.equal(target.coordinator.incoming.get('file-1'), record); assert.deepEqual(target.failures, []);
  target.coordinator.connectionChanged(true, false);
  target.coordinator.setSources('file-1', ['source']);
  assert.ok(record.request);
  target.coordinator.connectionChanged(true, true);
  target.coordinator.setSources('file-1', []);
  assert.deepEqual(target.failures, ['interrupted']);
});

test('new holders wake a failed file while unchanged exhausted holders stay skipped', async () => {
  const net = await network(), target = net.add('target');
  net.dropControl = () => true;
  target.coordinator.ensureAvailable(meta(1), ['exhausted']);
  net.clock.tick(6000);
  assert.equal(target.coordinator.ensureAvailable(meta(1), ['exhausted']), null);
  const record = target.coordinator.ensureAvailable(meta(1), ['exhausted', 'new-holder']);
  assert.equal(record.senderId, 'new-holder');
  assert.equal(record.exhausted.has('exhausted'), true);
  target.coordinator.cancelFile('file-1', false);
  target.coordinator.setSources('file-1', []);
  const returned = target.coordinator.ensureAvailable(meta(1), ['exhausted']);
  assert.equal(returned.senderId, 'exhausted');
  assert.equal(returned.exhausted.has('exhausted'), false);
  target.coordinator.disposeRoom();
});

test('cancellation during decryption cannot accept or ACK the chunk', async () => {
  const gate = deferred(), net = await network();
  const source = net.add('source');
  const target = net.add('target', { crypto: {
    randomUUID: () => webcrypto.randomUUID(),
    subtle: { decrypt: async (...args) => { await gate.promise; return webcrypto.subtle.decrypt(...args); } },
  } });
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([7]).buffer });
  target.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => net.frames.length === 1);
  target.coordinator.cancelFile('file-1'); gate.resolve(); await flush();
  assert.equal(target.coordinator.incoming.size, 0); assert.equal(target.items.has('file-1'), false);
  assert.equal(net.messages.some(m => m.payload.type === 'chunk_ack'), false);
  assert.equal(target.coordinator.ensureAvailable(meta(1), ['source']), null);
});

test('room disposal during commit makes the completion guard false', async () => {
  const gate = deferred(), net = await network(); const source = net.add('source'); let committed = false;
  const target = net.add('target', { commitFile: async (metadata, bytes, live) => { await gate.promise; committed = live(); return committed; } });
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([7]).buffer });
  target.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => target.coordinator.incoming.get('file-1')?.state === 'assembling');
  target.coordinator.disposeRoom(); gate.resolve(); await flush();
  assert.equal(committed, false); assert.equal(target.coordinator.incoming.size, 0);
  assert.equal(net.messages.some(m => m.payload.type === 'transfer_complete'), false);
  assert.equal(target.coordinator.scheduler.hasPending(), false);
});

test('empty file completes and wrong keys fail without acknowledging ciphertext', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  source.items.set('file-1', { ...meta(0), rawBuffer: new ArrayBuffer(0) });
  target.coordinator.ensureAvailable(meta(0), ['source']);
  await settle(() => target.items.has('file-1'));
  assert.equal(target.items.get('file-1').rawBuffer.byteLength, 0);
  const other = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const wrong = net.add('wrong', { getKey: () => other });
  wrong.coordinator.ensureAvailable(meta(0), ['source']);
  await settle(() => wrong.failures.length > 0);
  assert.deepEqual(wrong.failures, ['validation']);
  assert.equal(net.messages.some(m => m.from === 'wrong' && m.payload.type === 'chunk_ack'), false);
});

test('stale outgoing cleanup cannot remove a replacement transfer', async () => {
  const net = await network(), source = net.add('source');
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([1]).buffer });
  await source.coordinator.serveRequest({ itemId: 'file-1', transferId: 'old', requestId: 'old-request', chunkIndexes: [0] }, 'target');
  const old = source.coordinator.outgoing.get('file-1').get('target');
  source.coordinator.handleControl({ type: 'transfer_complete', itemId: 'file-1', transferId: 'old' }, 'target');
  const cleanup = net.clock.timers.get(old.timer).fn;
  await source.coordinator.serveRequest({ itemId: 'file-1', transferId: 'new', requestId: 'new-request', chunkIndexes: [0] }, 'target');
  cleanup();
  assert.equal(source.coordinator.outgoing.get('file-1').get('target').transferId, 'new');
});

test('late duplicate metadata cannot restart an already completed assembly', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([1]).buffer });
  target.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => target.coordinator.incoming.get('file-1')?.state === 'complete');
  const metadata = net.messages.find(message => message.payload.type === 'file_metadata').payload;
  target.coordinator.handleControl(metadata, 'source');
  assert.equal(target.coordinator.incoming.get('file-1').state, 'complete');
  assert.deepEqual(target.failures, []);
});

test('late ACKs and duplicate completion cannot extend a completed outgoing transfer', async () => {
  const net = await network();
  const updates = [];
  const source = net.add('source', { onOutgoing: (itemId, peerId, record) => updates.push(record?.state || 'removed') });
  const target = net.add('target');
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([1]).buffer });
  target.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => source.coordinator.outgoing.get('file-1')?.get('target')?.complete);
  const record = source.coordinator.outgoing.get('file-1').get('target');
  const timer = record.timer;
  const completedUpdates = updates.filter(state => state === 'complete').length;
  net.clock.tick(500);
  source.coordinator.handleControl(net.messages.find(message => message.payload.type === 'chunk_ack').payload, 'target');
  source.coordinator.handleControl(net.messages.find(message => message.payload.type === 'transfer_complete').payload, 'target');
  assert.equal(record.timer, timer);
  assert.equal(updates.filter(state => state === 'complete').length, completedUpdates);
  net.clock.tick(1000);
  assert.equal(source.coordinator.outgoing.size, 0);
});

test('a blocked recipient does not prevent another recipient from completing', async () => {
  const net = await network(), a = net.add('a'), b = net.add('b');
  const source = net.add('source', { sendFrame: async (peerId, frame, live) => {
    if (peerId === 'a') return { status: 'blocked' };
    if (live()) await b.coordinator.acceptFrame(frame.buffer, 'ws');
    return { status: 'sent', transport: 'ws' };
  } });
  source.items.set('file-1', { ...meta(1), rawBuffer: new Uint8Array([1]).buffer });
  a.coordinator.ensureAvailable(meta(1), ['source']); b.coordinator.ensureAvailable(meta(1), ['source']);
  await settle(() => b.items.has('file-1'));
  assert.equal(a.items.has('file-1'), false);
  source.coordinator.disposeRoom();
});

test('tampered authenticated header and wrong WebRTC peer are rejected', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  net.dropFrame = () => true;
  source.items.set('file-1', { ...meta(CHUNK_SIZE * 2), rawBuffer: new ArrayBuffer(CHUNK_SIZE * 2) });
  target.coordinator.ensureAvailable(meta(CHUNK_SIZE * 2), ['source']);
  await settle(() => net.frames.length === 2);
  assert.equal(await target.coordinator.acceptFrame(net.frames[0].frame.buffer, 'webrtc', 'imposter'), false);
  const decoded = decodeFrame(net.frames[0].frame.buffer);
  const tampered = encodeFrame({ ...decoded.header, ci: 1 }, new Uint8Array(decoded.payload));
  assert.equal(await target.coordinator.acceptFrame(tampered.buffer, 'ws'), false);
  assert.deepEqual(target.failures, ['validation']);
  assert.equal(net.messages.some(message => message.payload.type === 'chunk_ack'), false);
});

test('cancellation during encryption releases the job without sending a frame', async () => {
  const net = await network(), gate = deferred();
  let encrypting = false;
  const source = net.add('source', { crypto: {
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: { encrypt: async (...args) => {
      encrypting = true; await gate.promise; return webcrypto.subtle.encrypt(...args);
    } },
  } });
  source.items.set('file-1', { ...meta(1), rawBuffer: new ArrayBuffer(1) });
  await source.coordinator.serveRequest({ itemId: 'file-1', transferId: 'transfer', requestId: 'request', chunkIndexes: [0] }, 'target');
  await settle(() => encrypting);
  source.coordinator.cancelFile('file-1'); gate.resolve();
  await settle(() => !source.coordinator.scheduler.running);
  assert.equal(net.frames.length, 0);
  assert.equal(source.coordinator.outgoing.size, 0);
  assert.equal(net.clock.timers.size, 0);
});

test('failed sends stop until the receiver requests missing chunks again', async () => {
  const net = await network(); let sends = 0;
  const source = net.add('source', { sendFrame: async () => { sends++; return { status: 'failed', transport: 'ws' }; } });
  source.items.set('file-1', { ...meta(1), rawBuffer: new ArrayBuffer(1) });
  const request = { itemId: 'file-1', transferId: 'transfer', requestId: 'first', chunkIndexes: [0] };
  await source.coordinator.serveRequest(request, 'target');
  await settle(() => !source.coordinator.scheduler.running);
  assert.equal(sends, 1);
  await source.coordinator.serveRequest({ ...request, requestId: 'second' }, 'target');
  await settle(() => !source.coordinator.scheduler.running);
  assert.equal(sends, 2);
});

test('duplicate chunks re-ACK once stored; stale ACKs cannot advance a replacement', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  net.dropFrame = () => true;
  source.items.set('file-1', { ...meta(CHUNK_SIZE + 1), rawBuffer: new ArrayBuffer(CHUNK_SIZE + 1) });
  target.coordinator.ensureAvailable(meta(CHUNK_SIZE + 1), ['source']);
  await settle(() => net.frames.length === 2);
  const frame = net.frames[0].frame.buffer;
  assert.equal(await target.coordinator.acceptFrame(frame, 'ws'), true);
  assert.equal(await target.coordinator.acceptFrame(frame, 'ws'), true);
  assert.equal(target.coordinator.incoming.get('file-1').received, 1);
  const acknowledgements = net.messages.filter(message => message.payload.type === 'chunk_ack');
  assert.equal(acknowledgements.length, 2);
  await source.coordinator.serveRequest({ itemId: 'file-1', transferId: 'replacement', requestId: 'new-request', chunkIndexes: [1] }, 'target');
  source.coordinator.handleControl(acknowledgements[0].payload, 'target');
  assert.equal(source.coordinator.outgoing.get('file-1').get('target').sent, 0);
  for (const host of [source, target]) host.coordinator.disposeRoom();
});

test('metadata geometry is immutable and duplicate requested indices are rejected', async () => {
  const net = await network(), source = net.add('source'), target = net.add('target');
  source.items.set('file-1', { ...meta(1), rawBuffer: new ArrayBuffer(1) });
  await source.coordinator.serveRequest({ itemId: 'file-1', transferId: 'transfer', requestId: 'request', chunkIndexes: [0, 0] }, 'target');
  assert.equal(source.coordinator.outgoing.size, 0);
  net.dropControl = () => true;
  const record = target.coordinator.ensureAvailable(meta(1), ['source']);
  target.coordinator.handleControl({ type: 'file_metadata', itemId: 'file-1', transferId: record.transferId,
    requestId: record.request.id, item: meta(2) }, 'source');
  assert.deepEqual(target.failures, ['validation']);
  assert.equal(target.coordinator.incoming.size, 0);
});
