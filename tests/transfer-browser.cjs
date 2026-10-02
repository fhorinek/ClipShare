/* Run after installing requirements-dev.txt and Playwright/Chromium. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const { tmpdir } = require('node:os');
const root = path.resolve(__dirname, '..');
const errors = [];
const contexts = [];
let browser, server, fixtureDirectory;

async function availablePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function client(url, relayOnly = false) {
  const context = await browser.newContext({ acceptDownloads: true });
  contexts.push(context);
  if (relayOnly) await context.addInitScript(() => { window.RTCPeerConnection = undefined; });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/control-receive-error|binary-receive-error|transfer-error/.test(message.text())) errors.push(message.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => ws?.readyState === WebSocket.OPEN && roomSnapshotReady);
  await page.evaluate(() => {
    window.transferEvents = [];
    const original = transferCoordinator.options.onIncoming;
    transferCoordinator.options.onIncoming = record => {
      window.transferEvents.push({ filename: record.meta.filename, transferId: record.transferId,
        state: record.state, received: record.received, transport: record.transport });
      original(record);
    };
  });
  return page;
}

async function ready(pages, count) {
  await Promise.all(pages.map(page => page.waitForFunction(n => connectedPeers.size === n
    && [...connectedPeers.values()].every(peer => peer.compatibility === 'compatible'), count)));
}

async function received(page, name, timeout = 20000) {
  await page.waitForFunction(filename => [...items.values()].some(item => item.filename === filename && item.rawBuffer), name, { timeout });
}

async function downloaded(page, name, expected) {
  await received(page, name);
  const id = await page.evaluate(filename => [...items.values()].find(item => item.filename === filename).id, name);
  const promise = page.waitForEvent('download');
  await page.locator('#card-' + id).getByTitle('Download', { exact: true }).click();
  const download = await promise;
  assert.deepEqual(await fs.readFile(await download.path()), expected);
}

(async () => {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.env.PYTHON || path.join(root, '.venv/bin/python'),
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warning'],
    { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverLog = '';
  server.stderr.on('data', chunk => { serverLog += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error(serverLog);
    try { if ((await fetch(origin)).ok) break; } catch { }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  const url = `${origin}/browser-transfer-test#${'a'.repeat(64)}`;
  const a = await client(url), b = await client(url), c = await client(url);
  await ready([a, b, c], 2);
  await Promise.all([a, b, c].map(page => page.waitForFunction(() => [...webRtcPeers.values()].filter(record => record.channel?.readyState === 'open').length === 2)));
  const lifetime = await a.evaluate(async () => {
    const peerId = '000-lifetime-test';
    const originalConfig = loadWebRtcConfig;
    const OriginalConnection = RTCPeerConnection;
    let creations = 0, reject;
    connectedPeers.set(peerId, { compatibility: 'compatible', label: 4 });
    window.RTCPeerConnection = class extends OriginalConnection {
      constructor(config) { super(config); creations++; }
    };
    try {
      loadWebRtcConfig = () => new Promise((resolve, fail) => { reject = fail; });
      const first = ensureWebRtcPeer(peerId), second = ensureWebRtcPeer(peerId);
      const singleFlight = first === second;
      closeWebRtcPeer(peerId);
      reject(new Error('Delayed config failure'));
      await first.catch(() => {});
      const cancelledStayedAbsent = !webRtcPeers.has(peerId) && creations === 0;
      loadWebRtcConfig = async () => ({ iceServers: [] });
      const third = ensureWebRtcPeer(peerId), fourth = ensureWebRtcPeer(peerId);
      const sharedCreation = third === fourth;
      const oldRecord = await third;
      attachWebRtcChannel(peerId, { close() {}, readyState: 'connecting' });
      const lateError = oldRecord.channel.onerror;
      closeWebRtcPeer(peerId);
      const replacement = await ensureWebRtcPeer(peerId);
      lateError();
      return { singleFlight, sharedCreation, cancelledStayedAbsent,
        replacementUnaffected: replacement.state === 'connecting', creations };
    } finally {
      closeWebRtcPeer(peerId);
      connectedPeers.delete(peerId);
      window.RTCPeerConnection = OriginalConnection;
      loadWebRtcConfig = originalConfig;
    }
  });
  assert.deepEqual(lifetime, { singleFlight: true, sharedCreation: true,
    cancelledStayedAbsent: true, replacementUnaffected: true, creations: 2 });
  console.log('PASS: WebRTC creation is single-flight and stale failures cannot replace live connections');
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 17);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  await a.locator('#file-input').setInputFiles({ name: 'direct.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await Promise.all([downloaded(b, 'direct.bin', bytes), downloaded(c, 'direct.bin', bytes)]);
  assert.equal(await b.evaluate(() => transferEvents.some(event => event.filename === 'direct.bin' && event.transport === 'webrtc')), true);
  console.log('PASS: three clients transfer and download identical bytes over WebRTC');

  await a.evaluate(() => {
    const original = transferCoordinator.options.sendFrame;
    let sends = 0;
    transferCoordinator.options.sendFrame = (peerId, frame, live) => {
      if (++sends === 4) closeAllWebRtcPeers();
      return original(peerId, frame, live);
    };
  });
  await a.locator('#file-input').setInputFiles({ name: 'fallback.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await Promise.all([downloaded(b, 'fallback.bin', bytes), downloaded(c, 'fallback.bin', bytes)]);
  assert.equal(await b.evaluate(() => transferEvents.some(event => event.filename === 'fallback.bin' && event.transport === 'ws')), true);
  console.log('PASS: closing WebRTC during a transfer falls back to the relay');

  const bId = await b.evaluate(() => clientId);
  await a.evaluate(target => {
    const original = transferCoordinator.options.sendFrame;
    window.holdTarget = target;
    window.holdTransfers = true;
    transferCoordinator.options.sendFrame = (peerId, frame, live) => {
      const decoded = ClipShareTransfers.decodeFrame(frame.buffer);
      if (peerId === holdTarget && holdTransfers && decoded.header.ci >= 8) {
        window.delayedFrame = Array.from(frame); return { status: 'blocked' };
      }
      return original(peerId, frame, live);
    };
  }, bId);
  await a.locator('#file-input').setInputFiles({ name: 'reconnect.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await b.waitForFunction(() => [...binaryTransfers.values()].some(record => record.meta.filename === 'reconnect.bin' && record.received >= 8));
  const transferId = await b.evaluate(() => [...binaryTransfers.values()].find(record => record.meta.filename === 'reconnect.bin').transferId);
  await b.evaluate(() => ws.close());
  await a.evaluate(() => { window.holdTransfers = false; });
  await ready([a, b, c], 2);
  await downloaded(b, 'reconnect.bin', bytes);
  assert.equal(await b.evaluate(id => transferEvents.some(event => event.transferId === id && event.state === 'complete'), transferId), true);
  console.log('PASS: control reconnection resumes the same partial download');

  await a.evaluate(() => { window.holdTransfers = true; });
  await a.locator('#file-input').setInputFiles({ name: 'delete.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await b.waitForFunction(() => [...binaryTransfers.values()].some(record => record.meta.filename === 'delete.bin' && record.received >= 8));
  const deleted = await a.evaluate(() => [...items.values()].find(item => item.filename === 'delete.bin').id);
  const delayed = await a.evaluate(() => window.delayedFrame);
  await a.evaluate(id => deleteItem(id), deleted);
  await Promise.all([b, c].map(page => page.waitForFunction(id => !items.has(id) && !roomManifest.has(id), deleted)));
  assert.equal(await b.evaluate(frame => handleBinaryMessage(new Uint8Array(frame).buffer, 'ws'), delayed), false);
  assert.equal(await b.evaluate(id => items.has(id), deleted), false);
  await a.evaluate(() => { window.holdTransfers = false; });
  console.log('PASS: deletion during transfer ignores delayed chunks');

  await a.locator('#btn-new-text').click();
  await a.locator('.text-content').first().fill('Shared text regression');
  await a.locator('#header-logo').click();
  await b.waitForFunction(() => [...items.values()].some(item => item.content === 'Shared text regression'));
  await a.locator('#btn-chat').click();
  await a.locator('#chat-input').fill('Chat regression');
  await a.locator('#chat-send').click();
  await c.waitForFunction(() => chatMessages.some(message => message.text === 'Chat regression'));
  assert.equal((await a.evaluate(() => buildDiagnosticSnapshot())).transfers.coordinator.protocolVersion, 2);
  console.log('PASS: text, chat, and diagnostics');

  const png = Buffer.from((await a.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, 2, 2);
    return canvas.toDataURL('image/png');
  })).split(',')[1], 'base64');
  await a.locator('#chat-file-input').setInputFiles({ name: 'preview.png', mimeType: 'image/png', buffer: png });
  await Promise.all([received(b, 'preview.png'), received(c, 'preview.png')]);
  assert.equal(await b.evaluate(() => [...items.values()].find(item => item.filename === 'preview.png').thumbnailDataUrl.startsWith('data:image/jpeg')), true);
  console.log('PASS: image previews and chat card thumbnails');

  await c.evaluate(() => {
    window.originalThumbnail = prepareImageThumbnail;
    prepareImageThumbnail = async (...args) => {
      await new Promise(resolve => { window.releaseThumbnail = resolve; });
      return originalThumbnail(...args);
    };
  });
  await a.locator('#file-input').setInputFiles({ name: 'cancel-preview.png', mimeType: 'image/png', buffer: png });
  await c.waitForFunction(() => [...binaryTransfers.values()].some(record => record.meta.filename === 'cancel-preview.png' && record.state === 'assembling'));
  const imageId = await c.evaluate(() => [...binaryTransfers.values()].find(record => record.meta.filename === 'cancel-preview.png').itemId);
  assert.equal(await c.evaluate(id => document.getElementById('ib-fill-' + id).style.width, imageId), '99%');
  assert.equal(await c.evaluate(id => !!items.get(id).rawBuffer, imageId), false);
  await a.evaluate(id => deleteItem(id), imageId);
  await c.waitForFunction(id => !items.has(id) && !binaryTransfers.has(id), imageId);
  await c.evaluate(() => { releaseThumbnail(); prepareImageThumbnail = originalThumbnail; });
  assert.equal(await c.evaluate(id => items.has(id), imageId), false);
  console.log('PASS: progress stays below completion and deletion during thumbnail work cannot recreate the card');

  assert.equal(await c.evaluate(async () => {
    const item = [...items.values()].find(item => item.filename === 'preview.png');
    const record = { itemId: item.id, ownerId: clientId, revision: nextManifestRevision(item.id),
      holders: [clientId], encryptedMeta: await encryptedManifestMeta(item) };
    const original = decryptMessage;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    decryptMessage = async (...args) => { await gate; return original(...args); };
    try {
      const pending = applyManifestRecord(record);
      disposeSharedItem(item.id, { deleted: true });
      release(); await pending;
      return !items.has(item.id) && !roomManifest.has(item.id);
    } finally { decryptMessage = original; }
  }), true);
  console.log('PASS: delayed manifest decryption cannot recreate a deleted card');

  await a.evaluate(() => {
    const original = transferCoordinator.options.sendFrame;
    transferCoordinator.options.sendFrame = (peerId, frame, live) => ClipShareTransfers.decodeFrame(frame.buffer).header.ci >= 8
      ? { status: 'blocked' } : original(peerId, frame, live);
  });
  await a.locator('#file-input').setInputFiles({ name: 'orphan.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await Promise.all([b, c].map(page => page.waitForFunction(() => [...binaryTransfers.values()].some(record => record.meta.filename === 'orphan.bin' && record.received >= 8))));
  await a.evaluate(() => leaveSpace());
  await Promise.all([b, c].map(page => page.waitForFunction(() => ![...items.values()].some(item => item.filename === 'orphan.bin') && connectedPeers.size === 1)));
  assert.equal(await b.evaluate(() => document.getElementById('toast-container').textContent.includes('Transfer interrupted.')), true);
  console.log('PASS: losing the final source removes unfinished downloads');

  await b.evaluate(() => {
    const original = transferCoordinator.options.sendFrame;
    transferCoordinator.options.sendFrame = (peerId, frame, live) => ClipShareTransfers.decodeFrame(frame.buffer).header.ci >= 8
      ? { status: 'blocked' } : original(peerId, frame, live);
  });
  await b.locator('#file-input').setInputFiles({ name: 'clear-pending.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await c.waitForFunction(() => [...binaryTransfers.values()].some(record => record.meta.filename === 'clear-pending.bin' && record.received >= 8));
  await Promise.all([b, c].map(page => page.evaluate(() => {
    window.urlsBeforeClear = [...items.values()].map(item => item.dataUrl).filter(url => url?.startsWith('blob:'));
    window.revokedUrls = [];
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { revokedUrls.push(url); original(url); };
  })));
  await b.evaluate(() => clearAllItems());
  await Promise.all([b, c].map(page => page.waitForFunction(() => items.size === 0 && roomManifest.size === 0)));
  assert.equal(await a.evaluate(() => transferCoordinator.scheduler.hasPending()), false);
  for (const page of [b, c]) assert.equal(await page.evaluate(() =>
    binaryTransfers.size === 0 && outboundTransfers.size === 0 && !transferCoordinator.scheduler.hasPending()
    && cardEncryptionKeys.size === 0 && editTimers.size === 0
    && urlsBeforeClear.every(url => revokedUrls.includes(url))), true);
  console.log('PASS: clearing removes cards, manifest entries, and transfer work');

  for (const page of [a, b, c]) await page.close();
  const relayUrl = `${origin}/relay-transfer-test#${'b'.repeat(64)}`;
  const r1 = await client(relayUrl, true), r2 = await client(relayUrl, true), r3 = await client(relayUrl, true);
  await ready([r1, r2, r3], 2);

  await r1.locator('#header-token').click();
  await r1.waitForFunction(() => pairingPin.length === 8 && pairingPinExpiresAt > Date.now());
  const pin = await r1.evaluate(() => pairingPin);
  const pairContext = await browser.newContext(); contexts.push(pairContext);
  const pairPage = await pairContext.newPage(); pairPage.on('pageerror', error => errors.push(error.message));
  await pairPage.goto(origin);
  await pairPage.locator('#token-input').fill('relay-transfer-test');
  await pairPage.locator('#pin-input').fill(pin);
  await pairPage.locator('#btn-join').click();
  await pairPage.waitForFunction(() => ws?.readyState === WebSocket.OPEN && roomSnapshotReady);
  assert.equal(await pairPage.evaluate(() => currentPassphrase), 'b'.repeat(64));
  await pairPage.close();
  await r1.locator('#token-modal-close').click();
  await ready([r1, r2, r3], 2);
  console.log('PASS: PIN pairing uses versioned sockets');
  await r1.locator('#file-input').setInputFiles({ name: 'relay.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await Promise.all([downloaded(r2, 'relay.bin', bytes), downloaded(r3, 'relay.bin', bytes)]);
  await r1.locator('#file-input').setInputFiles({ name: 'empty.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(0) });
  await downloaded(r2, 'empty.bin', Buffer.alloc(0));
  console.log('PASS: relay-only delivery to two recipients and empty file');

  await r3.reload();
  await ready([r1, r2, r3], 2);
  await downloaded(r3, 'relay.bin', bytes);
  console.log('PASS: refreshed client retrieves existing files from the manifest');

  const large = Buffer.alloc(128 * 1024 * 1024); large.fill(Buffer.from([0, 1, 2, 3, 251, 255]));
  fixtureDirectory = await fs.mkdtemp(path.join(tmpdir(), 'clipshare-browser-'));
  const fixture = path.join(fixtureDirectory, 'boundary.bin');
  await fs.writeFile(fixture, large);
  await r1.locator('#file-input').setInputFiles(fixture);
  await Promise.all([received(r2, 'boundary.bin', 120000), received(r3, 'boundary.bin', 120000)]);
  await downloaded(r2, 'boundary.bin', large);
  const digest = await r3.evaluate(async () => {
    const item = [...items.values()].find(item => item.filename === 'boundary.bin');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', item.rawBuffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  });
  assert.equal(digest, createHash('sha256').update(large).digest('hex'));
  console.log('PASS: 128 MB boundary file matches downloaded bytes and digest');
  assert.deepEqual(errors, []);
})().catch(async error => {
  console.error(error);
  console.error('Browser errors:', errors);
  for (const context of contexts) for (const page of context.pages()) {
    console.error(await page.evaluate(() => ({
      transfers: transferCoordinator.snapshot(),
      items: [...items.values()].map(item => ({ id: item.id, type: item.type, size: item.size, ready: !!item.rawBuffer })),
      manifest: [...roomManifest.values()].map(record => ({ ownerId: record.ownerId, holders: record.holders, meta: record.meta })),
    })).catch(() => 'Page unavailable'));
  }
  process.exitCode = 1;
}).finally(async () => {
  for (const context of contexts) await context.close().catch(() => {});
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM'); await exited;
  }
  if (fixtureDirectory) await fs.rm(fixtureDirectory, { recursive: true, force: true });
});
