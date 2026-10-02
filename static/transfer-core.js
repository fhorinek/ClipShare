/* Shared by the browser and Node tests. No DOM or socket dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClipShareTransfers = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const PROTOCOL_VERSION = 2;
  const CHUNK_SIZE = 65536;
  const MAX_FILE_BYTES = 128 * 1024 * 1024;
  const MAX_CHUNKS = MAX_FILE_BYTES / CHUNK_SIZE;
  const BATCH_SIZE = 16;
  const HEADER_LIMIT = 4096;
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const chunkCount = size => Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const validIndex = (index, total) => Number.isInteger(index) && index >= 0 && index < total;

  function geometry(meta) {
    if (!object(meta) || !validId(meta.id) || !['file', 'image'].includes(meta.type)
        || !Number.isInteger(meta.size) || meta.size < 0 || meta.size > MAX_FILE_BYTES
        || (meta.filename !== undefined && (typeof meta.filename !== 'string' || meta.filename.length > 4096))
        || (meta.mimeType !== undefined && (typeof meta.mimeType !== 'string' || meta.mimeType.length > 255))
        || (meta.thumbnailDataUrl !== undefined && (typeof meta.thumbnailDataUrl !== 'string' || meta.thumbnailDataUrl.length > 4 * 1024 * 1024))
        || (meta.chunkSize !== undefined && meta.chunkSize !== CHUNK_SIZE)
        || (meta.totalChunks !== undefined && meta.totalChunks !== chunkCount(meta.size))) return null;
    const clean = { chunkSize: CHUNK_SIZE, totalChunks: chunkCount(meta.size) };
    for (const key of ['id', 'type', 'size', 'filename', 'mimeType', 'addedAt', 'encrypted', 'thumbnailDataUrl']) {
      if (meta[key] !== undefined) clean[key] = meta[key];
    }
    return clean;
  }

  function expectedChunkBytes(meta, index) {
    return validIndex(index, meta.totalChunks) ? Math.min(CHUNK_SIZE, meta.size - index * CHUNK_SIZE) : -1;
  }

  function assemble(meta, chunks) {
    const clean = geometry(meta);
    if (!clean || !Array.isArray(chunks) || chunks.length !== clean.totalChunks || Array.from(chunks).some((chunk, i) =>
      !(chunk instanceof ArrayBuffer) || chunk.byteLength !== expectedChunkBytes(clean, i))) {
      throw new Error('File chunks do not match metadata');
    }
    const bytes = new Uint8Array(clean.size);
    chunks.forEach((chunk, i) => bytes.set(new Uint8Array(chunk), i * CHUNK_SIZE));
    return bytes.buffer;
  }

  function validHeader(header) {
    return object(header) && header.v === PROTOCOL_VERSION && header.t === 'efc'
      && ['i', 'x', 'q', 'sid', 'rid'].every(key => validId(header[key]))
      && Number.isInteger(header.tc) && header.tc >= 1 && header.tc <= MAX_CHUNKS
      && validIndex(header.ci, header.tc)
      && (header.tid === undefined || header.tid === header.rid);
  }

  function frameAAD(header) {
    return new TextEncoder().encode(JSON.stringify([
      header.v, header.t, header.i, header.x, header.q, header.ci, header.tc, header.sid, header.rid,
    ]));
  }

  function encodeFrame(header, payload) {
    if (!validHeader(header) || !(payload instanceof Uint8Array)
        || payload.byteLength < 28 || payload.byteLength > CHUNK_SIZE + 28) throw new Error('Invalid binary frame');
    const encoded = new TextEncoder().encode(JSON.stringify(header));
    if (encoded.length > HEADER_LIMIT) throw new Error('Binary header too large');
    const bytes = new Uint8Array(4 + encoded.length + payload.length);
    new DataView(bytes.buffer).setUint32(0, encoded.length, false);
    bytes.set(encoded, 4);
    bytes.set(payload, 4 + encoded.length);
    return bytes;
  }

  function decodeFrame(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) return null;
    const length = new DataView(buffer).getUint32(0, false);
    if (length < 1 || length > HEADER_LIMIT || buffer.byteLength < 4 + length + 28
        || buffer.byteLength > 4 + length + CHUNK_SIZE + 28) return null;
    try {
      const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, 4, length)));
      return validHeader(header) ? { header, payload: buffer.slice(4 + length) } : null;
    } catch { return null; }
  }

  class ChunkScheduler {
    constructor({ onChange = () => {}, onError = () => {}, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
      this.queue = [];
      this.running = false;
      this.onChange = onChange;
      this.onError = onError;
      this.delay = delay;
    }
    enqueue(itemId, priority, makeIter) {
      const controller = new AbortController();
      const entry = { itemId, priority, controller, iter: makeIter(controller.signal),
        get cancelled() { return controller.signal.aborted; }, cancel() { controller.abort(); } };
      this.queue.push(entry);
      this._run();
      this.onChange();
      return entry;
    }
    cancelItem(itemId) {
      for (const entry of this.queue) if (entry.itemId === itemId) entry.cancel();
      this.onChange();
    }
    clear() { for (const entry of this.queue) entry.cancel(); this.onChange(); }
    hasPending() { return this.queue.some(entry => !entry.cancelled); }
    async _run() {
      if (this.running) return;
      this.running = true;
      this.onChange();
      try {
        while (this.queue.length) {
          this.queue = this.queue.filter(entry => !entry.cancelled);
          const entry = this.queue[0];
          if (!entry) break;
          let result;
          try { result = await entry.iter.next(); }
          catch (error) { result = { done: true }; if (!entry.cancelled) this.onError(error, entry); }
          // The queue can change during next(). Remove this exact job, never its new head.
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          if (!entry.cancelled && !result.done) this.queue.push(entry);
          await this.delay(result.value === 'blocked' ? 20 : 0);
        }
      } finally {
        this.running = false;
        this.onChange();
        if (this.hasPending()) this._run();
      }
    }
  }

  class TransferCoordinator {
    constructor(options) {
      this.options = options;
      this.clientId = options.clientId;
      this.crypto = options.crypto || globalThis.crypto;
      this.now = options.now || Date.now;
      this.setTimer = options.setTimer || ((fn, ms) => globalThis.setTimeout(fn, ms));
      this.clearTimer = options.clearTimer || (id => globalThis.clearTimeout(id));
      this.uuid = options.uuid || (() => this.crypto.randomUUID());
      this.incoming = new Map();
      this.outgoing = new Map(); // itemId -> Map<recipientId, delivery>
      this.failedSources = new Map(); // Source exclusions survive removal of an unfinished card.
      this.tombstones = new Set();
      this.epoch = 0;
      this.connected = false;
      this.authoritative = false;
      this.scheduler = new ChunkScheduler({
        delay: options.delay,
        onChange: () => options.onActivity?.(),
        onError: (error, entry) => options.onError?.(error, entry),
      });
    }

    live(record) {
      return record.epoch === this.epoch && !record.cancelled && this.incoming.get(record.itemId) === record;
    }
    outgoingLive(record) {
      return record.epoch === this.epoch && !record.cancelled && this.outgoing.get(record.itemId)?.get(record.peerId) === record;
    }
    emit(record) { if (this.live(record)) this.options.onIncoming?.(record); }
    emitOutgoing(record) { if (this.outgoingLive(record)) this.options.onOutgoing?.(record.itemId, record.peerId, record); }
    send(peerId, payload, guard = () => true) {
      const epoch = this.epoch;
      const live = () => epoch === this.epoch && guard();
      if (!live()) return Promise.resolve(false);
      return Promise.resolve(this.options.sendControl(peerId, payload, live)).catch(error => {
        this.options.onError?.(error);
        return false;
      });
    }

    ensureAvailable(metadata, sources = []) {
      const meta = geometry(metadata);
      if (!meta || this.tombstones.has(meta.id) || this.options.getItem(meta.id)?.rawBuffer) return null;
      sources = this.cleanSources(sources);
      this.updateFailedSources(meta.id, sources);
      let record = this.incoming.get(meta.id);
      if (!record) {
        const failed = this.failedSources.get(meta.id);
        if (failed && sources.length && sources.every(id => failed.exhausted.has(id))) return null;
        record = { itemId: meta.id, meta, transferId: this.uuid(), epoch: this.epoch,
          state: 'waiting-for-metadata', cancelled: false, received: 0, totalChunks: meta.totalChunks,
          chunks: new Array(meta.totalChunks).fill(null), chunkSources: new Array(meta.totalChunks).fill(''),
          sources: sources.slice(), exhausted: new Set(failed?.exhausted), attempts: new Map(), metadataConfirmed: false,
          request: null, timer: null, senderId: '', transport: '', currentChunk: 0,
          startTime: this.now(), lastProgressAt: this.now(), contributors: new Set() };
        this.incoming.set(meta.id, record);
      } else if (!this.sameFile(record.meta, meta)) return record;
      this.setSources(meta.id, sources);
      return this.incoming.get(meta.id) || null;
    }

    sameFile(a, b) {
      return ['id', 'size', 'type', 'chunkSize', 'totalChunks', 'filename', 'mimeType']
        .every(key => (a[key] ?? '') === (b[key] ?? ''));
    }

    cleanSources(candidates) {
      return [...new Set((Array.isArray(candidates) ? candidates : []).filter(id => validId(id) && id !== this.clientId))];
    }

    updateFailedSources(itemId, sources) {
      const failed = this.failedSources.get(itemId);
      if (!failed) return;
      for (const id of failed.sources) if (!sources.includes(id)) failed.exhausted.delete(id);
      failed.sources = sources;
    }

    setSources(itemId, candidates) {
      const sources = this.cleanSources(candidates);
      this.updateFailedSources(itemId, sources);
      const record = this.incoming.get(itemId);
      if (!record || ['assembling', 'complete'].includes(record.state)) return;
      for (const id of sources) if (!record.sources.includes(id)) {
        record.exhausted.delete(id); record.attempts.delete(id);
      }
      record.sources = sources;
      if (!this.connected) return;
      if (!sources.length) {
        if (this.authoritative) this.fail(record, 'interrupted');
        return;
      }
      this.emit(record);
      if (record.request && !sources.includes(record.senderId)) this.stopRequest(record);
      if (!record.request) this.requestNext(record);
    }

    connectionChanged(connected, authoritative = false) {
      this.connected = connected;
      this.authoritative = connected && authoritative;
      if (!connected) {
        this.failedSources.clear();
        for (const record of this.incoming.values()) this.stopRequest(record);
        return;
      }
      if (!authoritative) return; // Refresh source candidates before using cached pre-disconnect peers.
      for (const record of [...this.incoming.values()]) this.setSources(record.itemId, record.sources);
    }

    stopRequest(record) {
      if (record.timer !== null) this.clearTimer(record.timer);
      record.timer = null;
      if (record.request) this.send(record.senderId, {
        type: 'transfer_cancel', itemId: record.itemId, transferId: record.transferId, requestId: record.request.id,
      });
      record.request = null;
    }

    requestNext(record) {
      if (!this.live(record) || !this.connected || ['assembling', 'complete'].includes(record.state)) return;
      const source = record.sources.find(id => !record.exhausted.has(id));
      if (!source) {
        if (record.sources.length || this.authoritative) this.fail(record, record.sources.length ? 'unresponsive' : 'interrupted');
        return;
      }
      const indexes = [];
      for (let i = 0; i < record.totalChunks && indexes.length < BATCH_SIZE; i++) if (record.chunks[i] === null) indexes.push(i);
      if (!indexes.length && record.metadataConfirmed) { this.finish(record); return; }
      // If metadata alone was delayed, request a duplicate chunk to obtain a fresh metadata response.
      if (!indexes.length) indexes.push(0);
      record.senderId = source;
      record.attempts.set(source, (record.attempts.get(source) || 0) + 1);
      const request = { id: this.uuid(), indexes: new Set(indexes), missing: new Set(indexes) };
      record.request = request;
      this.send(source, { type: 'file_request', itemId: record.itemId, transferId: record.transferId,
        requestId: request.id, chunkIndexes: indexes }, () => this.live(record) && record.request === request);
      this.arm(record);
      this.emit(record);
    }

    arm(record) {
      if (record.timer !== null) this.clearTimer(record.timer);
      const request = record.request;
      record.timer = this.setTimer(() => {
        record.timer = null;
        if (!this.live(record) || record.request !== request || !this.connected) return;
        const source = record.senderId;
        this.stopRequest(record);
        if ((record.attempts.get(source) || 0) >= 3) record.exhausted.add(source);
        this.requestNext(record);
      }, 2000);
    }

    fail(record, reason) {
      if (!this.live(record)) return;
      record.state = 'failed';
      this.failedSources.set(record.itemId, { sources: record.sources.slice(), exhausted: new Set(record.exhausted) });
      this.cancelFile(record.itemId, false);
      this.options.onFailure?.(record.itemId, reason);
    }

    rejectSource(record, reason) {
      record.exhausted.add(record.senderId);
      this.stopRequest(record);
      if (record.sources.every(id => record.exhausted.has(id))) this.fail(record, reason);
      else this.requestNext(record);
    }

    matchingRequest(payload, peerId) {
      const record = this.incoming.get(payload.itemId);
      return record && this.live(record) && record.transferId === payload.transferId
        && record.senderId === peerId && record.request?.id === payload.requestId ? record : null;
    }

    handleControl(payload, peerId) {
      if (!object(payload) || !validId(peerId) || !validId(payload.itemId)
          || !validId(payload.transferId)) return;
      if (payload.type === 'file_request') return this.serveRequest(payload, peerId);
      if (payload.type === 'file_metadata') {
        const record = this.matchingRequest(payload, peerId);
        if (!record) return;
        if (record.state === 'assembling' || record.state === 'complete') return;
        const meta = geometry(payload.item);
        if (!meta || !this.sameFile(record.meta, meta)) { this.rejectSource(record, 'validation'); return; }
        record.metadataConfirmed = true;
        record.state = 'receiving';
        this.emit(record);
        if (record.received === record.totalChunks) this.finish(record);
        else if (!record.request.missing.size) { this.stopRequest(record); this.requestNext(record); }
      } else if (payload.type === 'file_unavailable') {
        const record = this.matchingRequest(payload, peerId);
        if (record) this.rejectSource(record, 'unresponsive');
      } else if (payload.type === 'chunk_ack') {
        const record = this.outgoing.get(payload.itemId)?.get(peerId);
        if (!record || !this.outgoingLive(record) || record.transferId !== payload.transferId
            || record.request?.id !== payload.requestId || !record.request.indexes.has(payload.chunkIndex)) return;
        record.ackedChunks.add(payload.chunkIndex);
        record.sent = record.ackedChunks.size;
        record.currentChunk = payload.chunkIndex + 1;
        this.touchOutgoing(record);
        this.emitOutgoing(record);
      } else if (payload.type === 'transfer_complete') {
        const record = this.outgoing.get(payload.itemId)?.get(peerId);
        if (!record || !this.outgoingLive(record) || record.transferId !== payload.transferId) return;
        record.complete = true;
        record.state = 'complete';
        this.failedSources.delete(record.itemId);
        record.sent = record.total;
        record.request?.job?.cancel();
        this.emitOutgoing(record);
        if (record.timer !== null) this.clearTimer(record.timer);
        record.timer = this.setTimer(() => this.removeOutgoing(record), 1500);
      } else if (payload.type === 'transfer_cancel') {
        const record = this.outgoing.get(payload.itemId)?.get(peerId);
        if (!record || record.transferId !== payload.transferId
            || (payload.requestId && record.request?.id !== payload.requestId)) return;
        record.request?.job?.cancel();
        if (!payload.requestId) this.removeOutgoing(record);
      }
    }

    async acceptFrame(buffer, transport, knownPeerId = null) {
      const frame = decodeFrame(buffer);
      if (!frame) return false;
      const { header, payload } = frame;
      if (header.rid !== this.clientId || (knownPeerId && header.sid !== knownPeerId)) return false;
      const record = this.matchingRequest({ itemId: header.i, transferId: header.x, requestId: header.q }, header.sid);
      if (!record || header.tc !== record.totalChunks || !record.request.indexes.has(header.ci)
          || payload.byteLength !== expectedChunkBytes(record.meta, header.ci) + 28) return false;
      const request = record.request;
      const key = this.options.getKey(header.i);
      if (!key) return false;
      let plain;
      try {
        plain = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload, 0, 12),
          additionalData: frameAAD(header) }, key, payload.slice(12));
      } catch {
        if (this.live(record) && record.request === request) this.rejectSource(record, 'validation');
        return false;
      }
      if (!this.live(record) || record.request !== request) return false;
      if (plain.byteLength !== expectedChunkBytes(record.meta, header.ci)) { this.rejectSource(record, 'validation'); return false; }
      if (record.chunks[header.ci] === null) {
        record.chunks[header.ci] = plain;
        record.chunkSources[header.ci] = header.sid;
        record.contributors.add(header.sid);
        record.received++;
        record.currentChunk = header.ci + 1;
        record.transport = transport;
        record.lastProgressAt = this.now();
        record.attempts.set(header.sid, 0);
        this.arm(record);
        this.emit(record);
      }
      request.missing.delete(header.ci);
      this.send(header.sid, { type: 'chunk_ack', itemId: header.i, transferId: header.x,
        requestId: header.q, chunkIndex: header.ci }, () => this.live(record));
      if (record.received === record.totalChunks && record.metadataConfirmed) this.finish(record);
      else if (!request.missing.size && record.metadataConfirmed) { this.stopRequest(record); this.requestNext(record); }
      return true;
    }

    async finish(record) {
      if (!this.live(record) || record.state === 'assembling' || record.state === 'complete' || !record.metadataConfirmed) return;
      if (record.timer !== null) this.clearTimer(record.timer);
      record.timer = null;
      record.state = 'assembling';
      this.emit(record);
      try {
        const buffer = assemble(record.meta, record.chunks);
        const committed = await this.options.commitFile(record.meta, buffer, () => this.live(record));
        if (!this.live(record)) return;
        if (committed === false) { this.fail(record, 'validation'); return; }
        record.state = 'complete';
        record.chunks = [];
        for (const peerId of record.contributors) this.send(peerId, {
          type: 'transfer_complete', itemId: record.itemId, transferId: record.transferId,
        });
        this.emit(record);
        record.timer = this.setTimer(() => {
          if (this.live(record)) { this.incoming.delete(record.itemId); this.options.onActivity?.(); }
        }, 1500);
      } catch (error) {
        if (this.live(record)) { this.options.onError?.(error); this.fail(record, 'validation'); }
      }
    }

    async serveRequest(payload, peerId) {
      if (!validId(payload.requestId) || !Array.isArray(payload.chunkIndexes)
          || !payload.chunkIndexes.length || payload.chunkIndexes.length > BATCH_SIZE
          || new Set(payload.chunkIndexes).size !== payload.chunkIndexes.length) return;
      const item = this.options.getItem(payload.itemId);
      const meta = item && geometry(item);
      if (!meta || !(item.rawBuffer instanceof ArrayBuffer) || item.rawBuffer.byteLength !== meta.size
          || this.tombstones.has(payload.itemId)) {
        this.send(peerId, { type: 'file_unavailable', itemId: payload.itemId,
          transferId: payload.transferId, requestId: payload.requestId });
        return;
      }
      if (!payload.chunkIndexes.every(index => validIndex(index, meta.totalChunks))) return;
      if (!this.outgoing.has(item.id)) this.outgoing.set(item.id, new Map());
      const peers = this.outgoing.get(item.id);
      let record = peers.get(peerId);
      if (record && record.transferId !== payload.transferId) { this.removeOutgoing(record); record = null; }
      if (!record) {
        record = { itemId: item.id, peerId, transferId: payload.transferId, epoch: this.epoch,
          cancelled: false, state: 'sending', sent: 0, total: meta.totalChunks,
          ackedChunks: new Set(), currentChunk: 0, startTime: this.now(), complete: false,
          transport: '', timer: null, request: null };
        if (!this.outgoing.has(item.id)) this.outgoing.set(item.id, new Map());
        this.outgoing.get(item.id).set(peerId, record);
      }
      if (record.complete) return;
      if (record.request?.id === payload.requestId && !record.request.job?.cancelled && !record.request.finished) return;
      record.request?.job?.cancel();
      const request = { id: payload.requestId, indexes: new Set(payload.chunkIndexes), finished: false };
      record.request = request;
      this.touchOutgoing(record);
      this.emitOutgoing(record);
      const key = this.options.getKey(item.id);
      if (!key) { this.removeOutgoing(record); return; }
      const live = () => this.outgoingLive(record) && record.request === request && this.options.getItem(item.id) === item;
      const sent = await this.send(peerId, { type: 'file_metadata', itemId: item.id,
        transferId: record.transferId, requestId: request.id, item: meta }, live);
      if (!sent || !live()) return;
      request.job = this.scheduler.enqueue(item.id, 0, signal => this.serveChunks(record, request, item, key, signal));
    }

    async *serveChunks(record, request, item, key, signal) {
      const live = () => !signal.aborted && this.outgoingLive(record) && record.request === request
        && this.options.getItem(item.id) === item && !this.tombstones.has(item.id);
      for (const index of request.indexes) {
        let frame = null;
        while (live()) {
          if (!this.connected) { yield 'blocked'; continue; }
          if (!frame) {
            const header = { v: PROTOCOL_VERSION, t: 'efc', i: item.id, x: record.transferId,
              q: request.id, ci: index, tc: record.total, sid: this.clientId, rid: record.peerId, tid: record.peerId };
            const iv = this.crypto.getRandomValues(new Uint8Array(12));
            const bytes = new Uint8Array(item.rawBuffer, index * CHUNK_SIZE, expectedChunkBytes(geometry(item), index));
            const encrypted = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: frameAAD(header) }, key, bytes);
            if (!live()) return;
            const payload = new Uint8Array(12 + encrypted.byteLength);
            payload.set(iv); payload.set(new Uint8Array(encrypted), 12);
            frame = encodeFrame(header, payload);
          }
          const result = await this.options.sendFrame(record.peerId, frame, live);
          if (!live()) return;
          if (result?.status === 'sent') {
            record.transport = result.transport;
            record.currentChunk = index + 1;
            this.emitOutgoing(record);
            yield;
            break;
          }
          if (result?.status === 'failed') { request.finished = true; return; }
          yield 'blocked';
        }
        if (!live()) return;
      }
      request.finished = true;
    }

    touchOutgoing(record) {
      if (record.timer !== null) this.clearTimer(record.timer);
      record.timer = this.setTimer(() => this.removeOutgoing(record), 30000);
    }

    removeOutgoing(record) {
      if (!this.outgoingLive(record)) return;
      record.cancelled = true;
      record.request?.job?.cancel();
      if (record.timer !== null) this.clearTimer(record.timer);
      const peers = this.outgoing.get(record.itemId);
      peers.delete(record.peerId);
      if (!peers.size) this.outgoing.delete(record.itemId);
      this.options.onOutgoing?.(record.itemId, record.peerId, null);
      this.options.onActivity?.();
    }

    peerDisconnected(peerId) {
      for (const failed of this.failedSources.values()) {
        failed.sources = failed.sources.filter(id => id !== peerId);
        failed.exhausted.delete(peerId);
      }
      for (const peers of [...this.outgoing.values()]) {
        const record = peers.get(peerId);
        if (record) this.removeOutgoing(record);
      }
      for (const record of [...this.incoming.values()]) this.setSources(record.itemId, record.sources.filter(id => id !== peerId));
    }

    cancelFile(itemId, deleted = true) {
      if (deleted) { this.tombstones.add(itemId); this.failedSources.delete(itemId); }
      const record = this.incoming.get(itemId);
      if (record) {
        this.stopRequest(record);
        for (const peerId of record.contributors) this.send(peerId, {
          type: 'transfer_cancel', itemId, transferId: record.transferId,
        });
        record.cancelled = true;
        record.state = 'cancelled';
        record.chunks = [];
        this.incoming.delete(itemId);
      }
      for (const delivery of [...(this.outgoing.get(itemId)?.values() || [])]) this.removeOutgoing(delivery);
      this.scheduler.cancelItem(itemId);
      this.options.onActivity?.();
    }

    disposeRoom() {
      this.epoch++;
      this.connected = false;
      this.authoritative = false;
      for (const record of this.incoming.values()) {
        record.cancelled = true; record.chunks = [];
        if (record.timer !== null) this.clearTimer(record.timer);
      }
      for (const peers of this.outgoing.values()) for (const record of peers.values()) {
        record.cancelled = true;
        if (record.timer !== null) this.clearTimer(record.timer);
      }
      this.scheduler.clear();
      this.incoming.clear(); this.outgoing.clear(); this.failedSources.clear(); this.tombstones.clear();
      this.options.onActivity?.();
    }

    snapshot() {
      return { protocolVersion: PROTOCOL_VERSION, epoch: this.epoch, connected: this.connected,
        authoritative: this.authoritative, queuedJobs: this.scheduler.queue.filter(job => !job.cancelled).length,
        failedSources: [...this.failedSources.entries()].map(([itemId, failed]) => ({ itemId, exhausted: [...failed.exhausted] })),
        incoming: [...this.incoming.values()].map(record => ({ itemId: record.itemId, transferId: record.transferId,
          requestId: record.request?.id, state: record.state, received: record.received, totalChunks: record.totalChunks,
          sourceId: record.senderId, sources: record.sources, exhausted: [...record.exhausted], transport: record.transport,
          attempts: Object.fromEntries(record.attempts) })),
        outgoing: [...this.outgoing.values()].flatMap(peers => [...peers.values()].map(record => ({
          itemId: record.itemId, transferId: record.transferId, peerId: record.peerId, state: record.state,
          requestId: record.request?.id, ackedChunks: [...record.ackedChunks], totalChunks: record.total, transport: record.transport,
        }))) };
    }
  }

  return { PROTOCOL_VERSION, CHUNK_SIZE, MAX_FILE_BYTES, MAX_CHUNKS, BATCH_SIZE,
    validId, geometry, expectedChunkBytes, assemble, validHeader, frameAAD, encodeFrame, decodeFrame, ChunkScheduler, TransferCoordinator };
});
