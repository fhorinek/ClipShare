// ── Utilities ────────────────────────────────────────────────────────
function randomUUID() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function humanSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function timeAgo(ts) {
  const stamp = Number(ts);
  if (!Number.isFinite(stamp)) return '';
  const diff = Math.max(0, Math.floor((Date.now() - stamp) / 1000));
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function refreshCardTimes() {
  document.querySelectorAll('.card-time[data-added-at]').forEach(el => {
    const text = el.querySelector('.card-time-text');
    if (text) text.textContent = timeAgo(el.dataset.addedAt);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

const TOKEN_MAX_LENGTH = 40;
const PASSPHRASE_ADJECTIVES = [
  'able', 'active', 'blue', 'bold', 'brave', 'bright', 'calm', 'clean',
  'clear', 'clever', 'cool', 'deep', 'dry', 'early', 'easy', 'fair',
  'fast', 'fine', 'fresh', 'gentle', 'glad', 'good', 'grand', 'green',
  'happy', 'honest', 'kind', 'large', 'light', 'little', 'lucky', 'merry',
  'mild', 'neat', 'new', 'nice', 'plain', 'proud', 'quick', 'quiet',
  'ready', 'red', 'rich', 'safe', 'sharp', 'short', 'simple', 'small',
  'smart', 'smooth', 'soft', 'solid', 'still', 'strong', 'sunny', 'sweet',
  'tidy', 'true', 'warm', 'white', 'wide', 'wise', 'young', 'zesty',
  'agile', 'awake', 'basic', 'better', 'brown', 'careful', 'cheerful', 'daily',
  'dear', 'eager', 'even', 'fancy', 'firm', 'gentle', 'golden', 'great',
  'humble', 'jolly', 'keen', 'level', 'loyal', 'major', 'modern', 'open',
  'patient', 'peaceful', 'polite', 'proper', 'purple', 'rapid', 'round', 'silver',
  'steady', 'tall', 'useful', 'vivid', 'welcome', 'yellow', 'young', 'zippy',
  'airy', 'bland', 'brisk', 'busy', 'chill', 'classic', 'cozy', 'crisp',
  'direct', 'exact', 'famous', 'fit', 'free', 'full', 'graceful', 'healthy',
  'humble', 'ideal', 'loose', 'normal', 'perfect', 'pretty', 'rare', 'regular',
  'silent', 'slow', 'square', 'stable', 'tough', 'vast', 'whole', 'wild'
];
const PASSPHRASE_NOUNS = [
  'apple', 'beach', 'bird', 'book', 'bread', 'bridge', 'cloud', 'desk',
  'door', 'dream', 'field', 'fire', 'flower', 'forest', 'friend', 'garden',
  'hill', 'home', 'house', 'key', 'lake', 'leaf', 'light', 'market',
  'meadow', 'moon', 'morning', 'music', 'paper', 'path', 'river', 'road',
  'room', 'school', 'shadow', 'ship', 'sky', 'star', 'stone', 'street',
  'sun', 'table', 'tree', 'valley', 'water', 'wind', 'window', 'wood',
  'air', 'anchor', 'artist', 'baker', 'basket', 'bell', 'bench', 'bottle',
  'branch', 'button', 'candle', 'castle', 'chair', 'circle', 'city', 'clock',
  'coin', 'corner', 'cup', 'dance', 'day', 'earth', 'engine', 'farm',
  'feather', 'floor', 'fruit', 'game', 'gift', 'glass', 'grass', 'heart',
  'island', 'jacket', 'kitchen', 'letter', 'line', 'map', 'mirror', 'mountain',
  'night', 'ocean', 'office', 'page', 'park', 'pencil', 'planet', 'plant',
  'pocket', 'rain', 'ring', 'roof', 'seed', 'shirt', 'silver', 'song',
  'spark', 'spring', 'square', 'station', 'summer', 'thread', 'ticket', 'tower',
  'train', 'village', 'voice', 'wave', 'wheel', 'yard', 'year', 'zone',
  'arrow', 'bag', 'ball', 'bank', 'boat', 'box', 'cake', 'card',
  'cart', 'case', 'coast', 'daylight', 'feast', 'frame', 'gate', 'ground',
  'harbor', 'idea', 'ladder', 'library', 'mile', 'nest', 'notebook', 'orange',
  'paint', 'party', 'phone', 'photo', 'plate', 'pool', 'radio', 'rail',
  'salt', 'screen', 'shape', 'shelf', 'sound', 'space', 'story', 'trail',
  'voice', 'wall', 'winter', 'word', 'world', 'zebra'
];

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, TOKEN_MAX_LENGTH);
}

function formatToken(value) {
  return normalizeToken(value);
}

function generateToken() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const adjective = PASSPHRASE_ADJECTIVES[bytes[0] % PASSPHRASE_ADJECTIVES.length];
  const noun = PASSPHRASE_NOUNS[bytes[1] % PASSPHRASE_NOUNS.length];
  return `${adjective}-${noun}`;
}

function generatePassphrase() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => String(byte % 10)).join('');
}

function tokenFromPath() {
  const seg = decodeURIComponent(location.pathname || '/').replace(/^\/+|\/+$/g, '');
  return normalizeToken(seg);
}

function passphraseFromHash() {
  return location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
}

function tokenShareUrl(t, passphrase = currentPassphrase) {
  const hash = passphrase ? `#${encodeURIComponent(passphrase)}` : '';
  return `${location.origin}/${encodeURIComponent(t)}${hash}`;
}

// Returns an MDI icon span with Ubuntu-style coloring
function fileTypeName(mime) {
  if (!mime) return 'File';
  const [type, sub] = mime.split('/');
  if (type === 'image') return (sub.split('+')[0].toUpperCase()) + ' Image';
  if (type === 'video') return (sub.split('+')[0].toUpperCase()) + ' Video';
  if (type === 'audio') {
    return ({ mpeg: 'MP3', ogg: 'OGG Audio', wav: 'WAV Audio', flac: 'FLAC Audio', aac: 'AAC Audio' }[sub] ?? (sub.toUpperCase() + ' Audio'));
  }
  if (type === 'text') {
    return ({ plain: 'Plain Text', html: 'HTML Document', css: 'CSS File', javascript: 'JavaScript', csv: 'CSV File', xml: 'XML File', markdown: 'Markdown' }[sub] ?? (sub.toUpperCase() + ' File'));
  }
  if (mime === 'application/pdf') return 'PDF Document';
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'Word Document';
  if (mime.includes('spreadsheetml') || mime.includes('excel')) return 'Excel Spreadsheet';
  if (mime.includes('presentationml') || mime.includes('powerpoint')) return 'PowerPoint Presentation';
  if (mime.includes('zip')) return 'ZIP Archive';
  if (mime.includes('tar')) return 'TAR Archive';
  if (mime.includes('gzip') || mime.includes('.gz')) return 'GZip Archive';
  if (mime.includes('7z')) return '7-Zip Archive';
  if (mime.includes('rar')) return 'RAR Archive';
  if (mime.includes('json')) return 'JSON File';
  if (mime.includes('xml')) return 'XML File';
  return 'File';
}

function fileTypeIcon(mime) {
  const m = mime || '';
  if (m.startsWith('image/')) return '<span class="mdi mdi-file-image file-type-icon" style="color:#26a69a"></span>';
  if (m.startsWith('video/')) return '<span class="mdi mdi-file-video file-type-icon" style="color:#5c6bc0"></span>';
  if (m.startsWith('audio/')) return '<span class="mdi mdi-file-music file-type-icon" style="color:#ec407a"></span>';
  if (m === 'application/pdf') return '<span class="mdi mdi-file-pdf-box file-type-icon" style="color:#ef5350"></span>';
  if (m.includes('zip') || m.includes('tar') || m.includes('gz') || m.includes('7z') || m.includes('rar'))
    return '<span class="mdi mdi-zip-box file-type-icon" style="color:#ffa726"></span>';
  if (m.includes('word') || m.includes('msword') || m.includes('document'))
    return '<span class="mdi mdi-file-word file-type-icon" style="color:#1565c0"></span>';
  if (m.includes('sheet') || m.includes('excel') || m.includes('spreadsheet'))
    return '<span class="mdi mdi-file-excel file-type-icon" style="color:#2e7d32"></span>';
  if (m.includes('presentation') || m.includes('powerpoint'))
    return '<span class="mdi mdi-file-powerpoint file-type-icon" style="color:#bf360c"></span>';
  if (m.startsWith('text/'))
    return '<span class="mdi mdi-file-document file-type-icon" style="color:#455a64"></span>';
  return '<span class="mdi mdi-file file-type-icon" style="color:#78909c"></span>';
}

function isBrowserViewableImage(mime) {
  const m = (mime || '').toLowerCase();
  return [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/avif',
  ].includes(m);
}

async function makeJpegThumbnail(blob, maxSize = 900) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = url;
    await loaded;
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareImageThumbnail(item, blob) {
  if (item?.type !== 'image' || isBrowserViewableImage(item.mimeType)) return;
  item.thumbnailDataUrl = await makeJpegThumbnail(blob);
  debugLog('thumbnail', { itemId: item.id, filename: item.filename, mimeType: item.mimeType, converted: !!item.thumbnailDataUrl });
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2100);
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function updatePeerCount() {
  const container = document.getElementById('peer-pills');
  if (!container) return;
  const imap = buildPeerIdentityMap();
  const selfId = imap.get(clientId);
  let html = `<div class="peer-pill" style="background:${selfId.bg}" title="${escHtml(selfId.fullName)} (You)"><i data-lucide="${selfId.animalIcon}" style="color:${selfId.iconColor}"></i></div>`;
  for (const [peerId] of connectedPeers) {
    const id = imap.get(peerId);
    html += `<div class="peer-pill" style="background:${id.bg}" title="${escHtml(id.fullName)}"><i data-lucide="${id.animalIcon}" style="color:${id.iconColor}"></i></div>`;
  }
  container.innerHTML = html;
  container.title = `${clientCount} connected user${clientCount === 1 ? '' : 's'}`;
  refreshIcons();
}

async function copyToken() {
  if (!token) return;
  try {
    await navigator.clipboard.writeText(token);
    showToast('Token copied!');
  } catch {
    showToast(token);
  }
}

async function copyShareUrl() {
  if (!token) return;
  const url = tokenShareUrl(token);
  try {
    await navigator.clipboard.writeText(url);
    showToast('URL copied!');
  } catch {
    showToast(url);
  }
}

async function copyPassphrase() {
  if (!currentPassphrase) return;
  try {
    await navigator.clipboard.writeText(currentPassphrase);
    showToast('Passphrase copied!');
  } catch {
    showToast(currentPassphrase);
  }
}

function isEditableTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ── State ───────────────────────────────────────────────────────────
const clientId = randomUUID();
let token = null;
let ws = null;
let dataWs = null;
let wsRetryDelay = 1000;
let dataWsRetryDelay = 1000;
let wsRetryTimer = null;
let dataWsRetryTimer = null;
const items = new Map();
const fileTransfers = new Map();   // base64/encrypted path: itemId -> {chunks,received,totalChunks,prefix}
const binaryTransfers = new Map(); // binary path: itemId -> {chunks,received,totalChunks}
const editTimers = new Map();
const CHUNK_SIZE = 65536;        // base64 chars per chunk (encrypted path)
const BINARY_CHUNK_SIZE = 65536; // bytes per chunk (binary path)
let clientCount = 0;
let draggingInternal = false;
let tokenQr = null;
let startQr = null;
let encryptedMessageSeq = 0;
let lastForegroundCheckAt = 0;

// ── Peer identity (color + animal) ───────────────────────────────────
const PEER_COLORS = [
  { name: 'Pink',   bg: '#fce4ec', icon: '#c2185b' },
  { name: 'Red',    bg: '#ffcdd2', icon: '#b71c1c' },
  { name: 'Orange', bg: '#ffe0b2', icon: '#e65100' },
  { name: 'Yellow', bg: '#fff9c4', icon: '#f57f17' },
  { name: 'Green',  bg: '#c8e6c9', icon: '#1b5e20' },
  { name: 'Teal',   bg: '#b2dfdb', icon: '#004d40' },
  { name: 'Blue',   bg: '#bbdefb', icon: '#0d47a1' },
  { name: 'Purple', bg: '#e1bee7', icon: '#4a148c' },
  { name: 'Indigo', bg: '#c5cae9', icon: '#1a237e' },
  { name: 'Brown',  bg: '#d7ccc8', icon: '#3e2723' },
  { name: 'Gray',   bg: '#cfd8dc', icon: '#263238' },
  { name: 'Coral',  bg: '#ffccbc', icon: '#bf360c' },
];
const PEER_ANIMALS = [
  { name: 'Bird',     icon: 'bird' },
  { name: 'Bug',      icon: 'bug' },
  { name: 'Cat',      icon: 'cat' },
  { name: 'Dog',      icon: 'dog' },
  { name: 'Fish',     icon: 'fish' },
  { name: 'Panda',    icon: 'panda' },
  { name: 'Rabbit',   icon: 'rabbit' },
  { name: 'Rat',      icon: 'rat' },
  { name: 'Shrimp',   icon: 'shrimp' },
  { name: 'Snail',    icon: 'snail' },
  { name: 'Squirrel', icon: 'squirrel' },
  { name: 'Turtle',   icon: 'turtle' },
  { name: 'Worm',     icon: 'worm' },
];
function buildPeerIdentityMap() {
  const selfNum = Number(selfPeerInfo.label) || 1;
  const entries = [
    { num: selfNum, cid: clientId },
    ...[...connectedPeers.entries()].map(([cid, p]) => ({ num: Number(p.label) || 0, cid })),
  ].filter(e => e.num > 0);

  entries.sort((a, b) => a.num - b.num || a.cid.localeCompare(b.cid));

  const map = new Map();
  const usedSlots = new Set();
  for (const { num, cid } of entries) {
    let slot = num - 1;
    let tries = 0;
    while (usedSlots.has(slot % 156) && tries < 156) { slot++; tries++; }
    const s = slot % 156;
    usedSlots.add(s);
    const color = PEER_COLORS[s % PEER_COLORS.length];
    const animal = PEER_ANIMALS[s % PEER_ANIMALS.length];
    map.set(cid, { bg: color.bg, iconColor: color.icon, animalIcon: animal.icon, fullName: `${color.name} ${animal.name}` });
  }
  return map;
}
function peerPillHtml(identity, extraClass = '') {
  return `<div class="peer-pill${extraClass ? ' ' + extraClass : ''}" style="background:${identity.bg}"><i data-lucide="${identity.animalIcon}" style="color:${identity.iconColor}"></i></div>`;
}

// ── Transfer scheduling & outbound tracking ──────────────────────────
const connectedPeers = new Map(); // peerId -> {label: string}
const peerCardMetadata = new Map(); // peerId -> Map<itemId, metadata>
let selfPeerInfo = { label: '1', ip: '' };
let peerCounter = 0;
const outboundTransfers = new Map(); // itemId -> Map<trackKey, {sent,total,startTime}>
const debugProgressMarks = new Map();
// Tracks ongoing broadcast position so new peers can receive missed chunks
const activeBroadcasts = new Map(); // itemId -> {nextChunk, totalChunks}

class ChunkScheduler {
  constructor() {
    this.queue = []; // [{itemId, priority, iter, cancelled}]
    this.running = false;
  }
  enqueue(itemId, priority, makeIter) {
    let cancelled = false;
    const entry = {
      itemId, priority,
      iter: makeIter(),
      get cancelled() { return cancelled; },
      cancel() { cancelled = true; },
    };
    this.queue.push(entry);
    this.queue.sort((a, b) => a.priority - b.priority);
    this._run();
    return entry;
  }
  cancelItem(itemId) {
    for (const e of this.queue) if (e.itemId === itemId) e.cancel();
  }
  async _run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        this.queue = this.queue.filter(e => !e.cancelled);
        if (!this.queue.length) break;
        this.queue.sort((a, b) => a.priority - b.priority);
        const entry = this.queue[0];
        try {
          const result = await entry.iter.next();
          if (result.done) this.queue.shift();
        } catch (err) {
          console.warn('Chunk send failed', err);
          this.queue.shift();
        }
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      this.running = false;
      if (this.queue.some(e => !e.cancelled)) this._run();
    }
  }
}
const chunkScheduler = new ChunkScheduler();

// ── Startup ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    document.getElementById('https-warning').style.display = 'block';
  }

  document.getElementById('btn-join').addEventListener('click', joinFromInput);
  document.getElementById('btn-create').addEventListener('click', regenerateTokenInput);
  document.getElementById('copy-start-url-btn').addEventListener('click', async () => {
    const url = document.getElementById('start-share-url').textContent;
    if (!url) return;
    try { await navigator.clipboard.writeText(url); showToast('URL copied!'); } catch { showToast(url); }
  });
  document.getElementById('token-input').addEventListener('input', e => { e.target.value = formatToken(e.target.value); updateStartSharePreview(); });
  document.getElementById('passphrase-input').addEventListener('input', updateStartSharePreview);
  document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinFromInput(); });
  document.getElementById('btn-clear').addEventListener('click', openClearModal);
  document.getElementById('btn-leave').addEventListener('click', openLeaveModal);
  document.getElementById('btn-paste').addEventListener('click', paste);
  document.getElementById('btn-upload').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('btn-new-text').addEventListener('click', createTextCard);
  document.getElementById('file-input').addEventListener('change', e => handleFiles(e.target.files));
  document.getElementById('header-token').addEventListener('click', openTokenModal);
  document.getElementById('encryption-control').addEventListener('click', () => openPassphraseModal());
  document.getElementById('peer-pills').addEventListener('click', openPeersModal);
  document.getElementById('token-modal-close').addEventListener('click', closeTokenModal);
  document.getElementById('token-modal').addEventListener('click', e => { if (e.target.id === 'token-modal') closeTokenModal(); });
  document.getElementById('copy-token-btn').addEventListener('click', copyToken);
  document.getElementById('copy-passphrase-btn').addEventListener('click', copyPassphrase);
  document.getElementById('copy-url-btn').addEventListener('click', copyShareUrl);
  document.getElementById('passphrase-modal').addEventListener('click', e => { if (e.target.id === 'passphrase-modal') closePassphraseModal(); });
  document.getElementById('passphrase-cancel').addEventListener('click', closePassphraseModal);
  document.getElementById('passphrase-save').addEventListener('click', savePassphraseFromModal);
  document.getElementById('passphrase-clear').addEventListener('click', clearPassphraseFromModal);
  document.getElementById('passphrase-modal-input').addEventListener('keydown', e => { if (e.key === 'Enter') savePassphraseFromModal(); });
  document.getElementById('peers-modal-close').addEventListener('click', closePeersModal);
  document.getElementById('peers-modal').addEventListener('click', e => { if (e.target.id === 'peers-modal') closePeersModal(); });
  document.getElementById('clear-modal').addEventListener('click', e => { if (e.target.id === 'clear-modal') closeClearModal(); });
  document.getElementById('leave-modal').addEventListener('click', e => { if (e.target.id === 'leave-modal') closeLeaveModal(); });
  document.getElementById('clear-cancel').addEventListener('click', closeClearModal);
  document.getElementById('clear-confirm').addEventListener('click', () => { closeClearModal(); clearAllItems(); });
  document.getElementById('leave-cancel').addEventListener('click', closeLeaveModal);
  document.getElementById('leave-confirm').addEventListener('click', () => { closeLeaveModal(); leaveSpace(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      const appVisible = document.getElementById('app').style.display !== 'none';
      if (!appVisible || isEditableTarget(e.target)) return;
      e.preventDefault();
      paste();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForegroundFreshness();
  });
  window.addEventListener('focus', checkForegroundFreshness);

  document.getElementById('app').addEventListener('dragstart', () => { draggingInternal = true; });
  document.addEventListener('dragend', () => { draggingInternal = false; });
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    if (draggingInternal) return;
    handleFiles(e.dataTransfer.files);
  });

  const pathToken = tokenFromPath();
  const hashPassphrase = passphraseFromHash();
  if (hashPassphrase) currentPassphrase = hashPassphrase;
  if (pathToken) {
    setToken(pathToken);
    if (hashPassphrase) setCurrentPassphrase(hashPassphrase, true);
  } else {
    loadTokenInputsFromStorage();
  }
  setInterval(refreshCardTimes, 30000);
  refreshIcons();
});

// ── Token management ────────────────────────────────────────────────
function saveTokenInputsToStorage(tokenValue, passphraseValue) {
  localStorage.setItem('clipshare_token', normalizeToken(tokenValue));
  localStorage.setItem('clipshare_passphrase', passphraseValue || '');
}

function updateStartSharePreview() {
  const preparedToken = normalizeToken(document.getElementById('token-input').value);
  const preparedPassphrase = document.getElementById('passphrase-input').value;
  const urlEl = document.getElementById('start-share-url');
  const qrEl = document.getElementById('start-qr-code');
  if (!preparedToken || !urlEl || !qrEl) return;

  const url = tokenShareUrl(preparedToken, preparedPassphrase);
  urlEl.textContent = url;
  qrEl.innerHTML = '';
  if (window.QRCode) {
    startQr = new QRCode(qrEl, {
      text: url,
      width: 170,
      height: 170,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrEl.textContent = 'QR unavailable';
  }
}

function loadTokenInputsFromStorage() {
  const savedToken = normalizeToken(localStorage.getItem('clipshare_token'));
  const savedPassphrase = localStorage.getItem('clipshare_passphrase') || '';
  if (savedToken) {
    document.getElementById('token-input').value = formatToken(savedToken);
    document.getElementById('passphrase-input').value = savedPassphrase;
    currentPassphrase = savedPassphrase;
  } else {
    regenerateTokenInput(false);
  }
  updateStartSharePreview();
}

function regenerateTokenInput(showMessage = true) {
  const newToken = generateToken();
  const newPassphrase = generatePassphrase();
  document.getElementById('token-input').value = formatToken(newToken);
  document.getElementById('passphrase-input').value = newPassphrase;
  currentPassphrase = newPassphrase;
  saveTokenInputsToStorage(newToken, newPassphrase);
  updateStartSharePreview();
  if (showMessage) showToast('New token and passphrase generated');
}

function joinFromInput() {
  const t = normalizeToken(document.getElementById('token-input').value);
  const passphrase = document.getElementById('passphrase-input').value;
  if (!t) return;
  if (passphrase) {
    currentPassphrase = passphrase;
  } else {
    currentPassphrase = '';
  }
  saveTokenInputsToStorage(t, passphrase);
  setToken(t);
}

function setToken(t) {
  token = normalizeToken(t);
  if (!token) return;
  localStorage.setItem('clipshare_token', token);
  history.replaceState({}, '', `/${encodeURIComponent(token)}`);
  document.getElementById('token-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('header-token').textContent = token;
  updateEmpty();
  connectWS();
}

function leaveSpace() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  if (dataWs) { dataWs.onclose = null; dataWs.close(); dataWs = null; }
  if (wsRetryTimer) { clearTimeout(wsRetryTimer); wsRetryTimer = null; }
  if (dataWsRetryTimer) { clearTimeout(dataWsRetryTimer); dataWsRetryTimer = null; }
  token = null;
  items.clear();
  cardEncryptionKeys.clear();
  peerCardMetadata.clear();
  fileTransfers.clear();
  binaryTransfers.clear();
  activeBroadcasts.clear();
  editTimers.forEach(clearTimeout);
  editTimers.clear();
  clientCount = 0;
  updatePeerCount();
  document.getElementById('cards').innerHTML = '';
  document.getElementById('app').style.display = 'none';
  document.getElementById('token-screen').style.display = 'flex';
  regenerateTokenInput(false);
  history.replaceState({}, '', '/');
  setDot('disconnected');
  updateEmpty();
}

function openClearModal() {
  if (!items.size) return;
  const modal = document.getElementById('clear-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeClearModal() {
  const modal = document.getElementById('clear-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openLeaveModal() {
  const modal = document.getElementById('leave-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeLeaveModal() {
  const modal = document.getElementById('leave-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function cardMetadataFromItem(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    type: item.type || 'unknown',
    filename: item.filename,
    mimeType: item.mimeType,
    size: item.size,
    addedAt: item.addedAt,
    encrypted: !!item.encrypted,
    thumbnailDataUrl: item.thumbnailDataUrl,
  };
}

function cardMetadataFromEncryptedMeta(meta = {}) {
  if (meta.payloadType === 'item_deleted') return null;
  if (!meta.itemId) return null;
  return {
    id: meta.itemId,
    type: meta.itemType || 'encrypted',
    addedAt: meta.addedAt,
    encrypted: true,
  };
}

function debugLog(event, details = {}) {
  console.log(`[ClipShare:${event}]`, {
    clientId: clientId.slice(0, 8),
    token,
    ...details,
  });
}

function debugProgress(event, itemId, done, total, details = {}) {
  const pct = total ? Math.floor((done / total) * 100) : 0;
  const bucket = pct >= 100 ? 100 : Math.floor(pct / 10) * 10;
  const key = `${event}:${itemId}:${details.peerId || details.targetId || details.path || 'local'}`;
  if (debugProgressMarks.get(key) === bucket) return;
  debugProgressMarks.set(key, bucket);
  debugLog(event, { itemId, done, total, percent: pct, ...details });
}

function publishClientCardMetadata(item) {
  const meta = cardMetadataFromItem(item);
  if (!meta || !ws || ws.readyState !== WebSocket.OPEN) return;
  debugLog('announce', { itemId: item.id, type: item.type, filename: item.filename, size: item.size, encrypted: !!item.encrypted });
  sendPriorityJson({ type: 'metadata_update', action: 'upsert', item: meta, encrypted: !!meta.encrypted });
}

function publishClientCardRemoval(itemId, reason = 'delete') {
  if (!itemId || !ws || ws.readyState !== WebSocket.OPEN) return;
  debugLog('announce-remove', { itemId, reason });
  sendPriorityJson({ type: 'metadata_update', action: 'delete', itemId });
}

function rememberPeerCardMetadata(peerId, metadata) {
  if (!peerId || peerId === clientId || !metadata?.id) return;
  if (!peerCardMetadata.has(peerId)) peerCardMetadata.set(peerId, new Map());
  peerCardMetadata.get(peerId).set(metadata.id, metadata);
}

function forgetPeerCardMetadata(peerId, itemId) {
  if (!peerId || !itemId) return;
  const cards = peerCardMetadata.get(peerId);
  if (!cards) return;
  cards.delete(itemId);
  if (!cards.size) peerCardMetadata.delete(peerId);
}

function applyPeerMetadataUpdate(msg) {
  if (!msg?.senderId || msg.senderId === clientId) return;
  if (msg.action === 'delete') {
    forgetPeerCardMetadata(msg.senderId, msg.itemId);
  } else if (msg.action === 'clear') {
    peerCardMetadata.delete(msg.senderId);
  } else if (msg.item) {
    rememberPeerCardMetadata(msg.senderId, msg.item);
  }
  if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
}

function seedPeerMetadataFromSources(sources = []) {
  for (const source of sources) {
    if (!source?.clientId) continue;
    const cards = new Map();
    (source.items || []).forEach(item => {
      const meta = cardMetadataFromItem(item);
      if (meta) cards.set(meta.id, meta);
    });
    if (cards.size) peerCardMetadata.set(source.clientId, cards);
  }
}

function peerCardTitle(meta) {
  if (meta.filename) return meta.filename;
  if (meta.type === 'text') return 'Text card';
  if (meta.type === 'image') return 'Image';
  if (meta.encrypted) return 'Encrypted card';
  return `${String(meta.type || 'Card').charAt(0).toUpperCase()}${String(meta.type || 'card').slice(1)}`;
}

function peerCardDetail(meta) {
  const parts = [];
  if (meta.encrypted) parts.push('Encrypted');
  if (meta.size) parts.push(humanSize(meta.size));
  if (meta.addedAt) parts.push(timeAgo(meta.addedAt));
  return parts.join(' | ') || 'Metadata';
}

function renderPeerCardMetadata(cards) {
  const metas = [...(cards || new Map()).values()].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  if (!metas.length) return '<div class="peer-card-empty">No cards</div>';
  return `<div class="peer-card-list">${metas.map(meta => `
    <div class="peer-card-meta">
      <span class="peer-card-name" title="${escAttr(peerCardTitle(meta))}">${escHtml(peerCardTitle(meta))}</span>
      <span>${escHtml(peerCardDetail(meta))}</span>
    </div>`).join('')}</div>`;
}

function peerDetail(id, peer) {
  return [peer?.ip, id.slice(0, 8)].filter(Boolean).join(' | ');
}

function openPeersModal() {
  const list = document.getElementById('peers-list');
  list.innerHTML = '';
  const imap = buildPeerIdentityMap();
  const selfId = imap.get(clientId);
  const rows = [
    { identity: selfId, label: `${selfId.fullName} (You)`, detail: peerDetail(clientId, selfPeerInfo), cards: new Map([...items.values()].map(item => [item.id, cardMetadataFromItem(item)]).filter(([, meta]) => meta)) },
    ...[...connectedPeers.entries()].map(([id, peer]) => {
      const pid = imap.get(id);
      return { identity: pid, label: pid.fullName, detail: peerDetail(id, peer), cards: peerCardMetadata.get(id) || new Map() };
    })
  ];

  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'peer-row peer-user-row';
    const itemCount = row.cards?.size || 0;
    el.innerHTML = `<div class="peer-row-main">${peerPillHtml(row.identity, 'peer-pill-sm')}<span>${escHtml(row.label)}</span><span class="spacer"></span><span class="token-modal-label">${itemCount} card${itemCount === 1 ? '' : 's'} | ${escHtml(row.detail)}</span></div>${renderPeerCardMetadata(row.cards)}`;
    list.appendChild(el);
  }

  const modal = document.getElementById('peers-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closePeersModal() {
  const modal = document.getElementById('peers-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function autoSelectSyncSource(sources) {
  const source = [...(sources || [])]
    .filter(candidate => candidate?.clientId)
    .sort((a, b) => {
      const aCount = a.itemCount || a.items?.length || 0;
      const bCount = b.itemCount || b.items?.length || 0;
      return bCount - aCount;
    })[0];
  if (source) requestSyncFrom(source.clientId);
}

function syncMissingFromSources(sources = []) {
  const missingSources = sources
    .map(source => ({
      ...source,
      missingCount: (source.items || []).filter(item => item?.id && !items.has(item.id)).length,
    }))
    .filter(source => source.clientId && source.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount);

  if (!missingSources.length) {
    debugLog('foreground-check-current', { sources: sources.length, localItems: items.size });
    return false;
  }

  debugLog('foreground-check-missing', {
    sourceClientId: missingSources[0].clientId,
    missingCount: missingSources[0].missingCount,
  });
  requestSyncFrom(missingSources[0].clientId);
  return true;
}

function checkForegroundFreshness() {
  if (!token || !ws || ws.readyState !== WebSocket.OPEN || document.hidden) return;
  const now = Date.now();
  if (now - lastForegroundCheckAt < 2000) return;
  lastForegroundCheckAt = now;
  debugLog('foreground-check-start', { localItems: items.size, peers: connectedPeers.size });
  sendPriorityJson({ type: 'metadata_snapshot_request' });
}

function requestSyncFrom(sourceClientId) {
  if (!sourceClientId) return;
  debugLog('retrieve-request', { sourceClientId });
  wsSend({
    type: 'relay',
    targetId: sourceClientId,
    payload: { type: 'sync_request', requesterId: clientId },
  }, null);
  showToast('Requesting files...');
}

function closeAllModals() {
  closeTokenModal();
  closePassphraseModal();
  closePeersModal();
  closeClearModal();
  closeLeaveModal();
}

function clearAllItems() {
  if (!items.size) return;
  for (const id of [...items.keys()]) {
    wsSend({ type: 'relay', payload: { type: 'item_deleted', itemId: id } }, cardEncryptionKeys.get(id));
  }
  items.clear();
  cardEncryptionKeys.clear();
  fileTransfers.clear();
  binaryTransfers.clear();
  activeBroadcasts.clear();
  editTimers.forEach(clearTimeout);
  editTimers.clear();
  document.getElementById('cards').innerHTML = '';
  updateEmpty();
  showToast('All cards cleared');
}

function openTokenModal() {
  if (!token) return;
  const url = tokenShareUrl(token);
  document.getElementById('token-modal-token').textContent = formatToken(token);
  document.getElementById('token-modal-passphrase').textContent = currentPassphrase || 'None';
  document.getElementById('token-modal-url').textContent = url;
  const qrEl = document.getElementById('token-modal-qr-code');
  qrEl.innerHTML = '';
  if (window.QRCode) {
    tokenQr = new QRCode(qrEl, {
      text: url,
      width: 170,
      height: 170,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrEl.textContent = 'QR unavailable';
  }
  const modal = document.getElementById('token-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closeTokenModal() {
  const modal = document.getElementById('token-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

let passphraseModalCardId = null;

function openPassphraseModal(cardId = null) {
  const cardMode = typeof cardId === 'string';
  passphraseModalCardId = cardMode ? cardId : null;
  const modal = document.getElementById('passphrase-modal');
  const input = document.getElementById('passphrase-modal-input');
  const title = document.getElementById('passphrase-modal-title');
  const clearBtn = document.getElementById('passphrase-clear');
  const saveBtn = document.getElementById('passphrase-save');
  input.value = cardMode ? '' : currentPassphrase || '';
  title.textContent = cardMode ? 'Open Encrypted Card' : 'Encryption Passphrase';
  clearBtn.style.display = cardMode ? 'none' : '';
  saveBtn.innerHTML = cardMode ? '<i data-lucide="key-round"></i> Open' : '<i data-lucide="lock"></i> Save';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
  requestAnimationFrame(() => input.focus());
}

function closePassphraseModal() {
  const modal = document.getElementById('passphrase-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  passphraseModalCardId = null;
}

async function savePassphraseFromModal() {
  const passphrase = document.getElementById('passphrase-modal-input').value;
  if (!passphrase) return;
  if (passphraseModalCardId) {
    await openEncryptedCardWithPassphrase(passphraseModalCardId, passphrase);
    return;
  }
  await setCurrentPassphrase(passphrase, true);
  closePassphraseModal();
}

function clearPassphraseFromModal() {
  currentPassphrase = '';
  encryptionKey = null;
  encryptionEnabled = false;
  localStorage.removeItem('clipshare_passphrase');
  updateEncryptionControl();
  closePassphraseModal();
  showToast('Encryption disabled');
}

// ── WebSocket ────────────────────────────────────────────────────────
let encryptionKey = null;
let encryptionEnabled = false;
let currentPassphrase = localStorage.getItem('clipshare_passphrase') || '';
const cardEncryptionKeys = new Map();

async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const passphraseBuf = encoder.encode(passphrase);
  const saltBuf = encoder.encode(salt);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', passphraseBuf, 'PBKDF2', false, ['deriveKey']
  );
  return await window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function updateEncryptionControl() {
  const btn = document.getElementById('encryption-control');
  if (!btn) return;
  const active = !!encryptionKey;
  btn.classList.toggle('active', active);
  btn.title = active ? 'Encryption on. Click to change passphrase.' : 'Encryption off. Click to set passphrase.';
  btn.innerHTML = `<i data-lucide="${active ? 'lock' : 'unlock'}"></i>`;
  refreshIcons();
}

async function setCurrentPassphrase(passphrase, tryUnlock = false) {
  if (!token) return;
  currentPassphrase = passphrase;
  encryptionKey = await deriveKey(passphrase, token);
  encryptionEnabled = true;
  localStorage.setItem('clipshare_passphrase', passphrase);
  updateEncryptionControl();

  if (tryUnlock) {
    const unlocked = await tryDecryptEncryptedCards(passphrase, encryptionKey);
    showToast(unlocked ? `Unlocked ${unlocked} encrypted card${unlocked === 1 ? '' : 's'}` : 'Passphrase saved');
  }
}

async function encryptMessage(message, key) {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(message)
  );
  return {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext))
  };
}

async function decryptMessage(encryptedData, key) {
  const decoder = new TextDecoder();
  const iv = new Uint8Array(encryptedData.iv);
  const ciphertext = new Uint8Array(encryptedData.ciphertext);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return decoder.decode(plaintext);
}

async function applyEncryptedMessage(encryptedData, key, senderId = null) {
  const decrypted = await decryptMessage(encryptedData, key);
  const innerMsg = JSON.parse(decrypted);
  if (innerMsg.type === 'relay') {
    handlePayload(innerMsg.payload, true, key, senderId);
  } else {
    await handleServerMessage(innerMsg);
  }
}

async function applyEncryptedMessages(encryptedMessages, key) {
  const ordered = [...encryptedMessages].sort((a, b) => {
    const aKind = a.meta?.payloadType;
    const bKind = b.meta?.payloadType;
    if (aKind === 'item_added' && bKind !== 'item_added') return -1;
    if (bKind === 'item_added' && aKind !== 'item_added') return 1;
    if (aKind === 'file_chunk' && bKind === 'file_chunk') {
      return (a.meta?.chunkIndex ?? 0) - (b.meta?.chunkIndex ?? 0);
    }
    return a.seq - b.seq;
  });

  for (const message of ordered) {
    await applyEncryptedMessage(message.data, key);
  }
}

function rememberKeyForEncryptedMessages(encryptedMessages, key) {
  for (const message of encryptedMessages) {
    const itemId = message.meta?.itemId;
    if (itemId) cardEncryptionKeys.set(itemId, key);
  }
}

async function unlockEncryptedCard(item, key) {
  await applyEncryptedMessages(item.encryptedMessages, key);
  rememberKeyForEncryptedMessages(item.encryptedMessages, key);
  await decryptStoredEncryptedBinaryChunks(item, key);
  items.delete(item.id);
  removeCardAnimated(item.id, updateEmpty);
}

async function tryDecryptEncryptedCards(passphrase, key) {
  let unlocked = 0;
  const encryptedCards = [...items.values()].filter(item => item.type === 'encrypted');
  for (const item of encryptedCards) {
    try {
      await unlockEncryptedCard(item, key);
      unlocked++;
    } catch {
      // Keep cards that do not match this passphrase locked.
    }
  }
  return unlocked;
}

async function applyEncryptedWithRememberedKey(msg) {
  const itemId = msg.meta?.itemId;
  const key = itemId ? cardEncryptionKeys.get(itemId) : null;
  if (!key) return false;
  await applyEncryptedMessage(msg.data, key, msg.senderId);
  return true;
}

function encryptedMetaForMessage(msg) {
  if (msg?.type !== 'relay') return { messageType: msg?.type || 'unknown' };
  const payload = msg.payload || {};
  if (payload.type === 'item_added' && payload.item) {
    return {
      messageType: 'relay',
      payloadType: 'item_added',
      itemId: payload.item.id,
      itemType: payload.item.type,
      addedAt: payload.item.addedAt
    };
  }
  if (payload.type === 'file_chunk') {
    return {
      messageType: 'relay',
      payloadType: 'file_chunk',
      itemId: payload.itemId,
      chunkIndex: payload.chunkIndex,
      totalChunks: payload.totalChunks
    };
  }
  return {
    messageType: 'relay',
    payloadType: payload.type || 'unknown',
    itemId: payload.itemId
  };
}

function encryptedPlaceholderId(meta) {
  return meta?.itemId ? `encrypted-${meta.itemId}` : randomUUID();
}

function encryptedPlaceholderIdForItem(itemId) {
  return `encrypted-${itemId}`;
}

function encryptedChunkStatus(item) {
  return item.totalEncryptedChunks
    ? `Encrypted chunks ${item.receivedEncryptedChunks || 0}/${item.totalEncryptedChunks}`
    : 'Password required';
}

function updateEncryptedPlaceholderCard(item) {
  const card = document.getElementById('card-' + item.id);
  if (!card) return;

  const status = card.querySelector('.encrypted-status');
  if (status) status.textContent = encryptedChunkStatus(item);

  const progressWrap = card.querySelector('.encrypted-progress-wrap');
  const progressFill = card.querySelector('.encrypted-progress');
  if (!progressWrap || !progressFill) return;

  if (item.totalEncryptedChunks) {
    const pct = Math.round(((item.receivedEncryptedChunks || 0) / item.totalEncryptedChunks) * 100);
    progressWrap.style.display = '';
    progressFill.style.width = pct + '%';
  } else {
    progressWrap.style.display = 'none';
    progressFill.style.width = '0%';
  }
}

function ensureEncryptedBinaryPlaceholder(itemId, totalChunks) {
  const groupId = encryptedPlaceholderIdForItem(itemId);
  let item = items.get(groupId);
  if (!item) {
    item = {
      id: groupId,
      type: 'encrypted',
      encryptedMeta: { payloadType: 'file_chunk', itemId, totalChunks },
      encryptedMessages: [],
      encryptedChunkIndexes: [],
      encryptedBinaryChunks: new Array(totalChunks).fill(null),
      receivedEncryptedChunks: 0,
      totalEncryptedChunks: totalChunks,
      encrypted: true,
      addedAt: Date.now()
    };
    items.set(item.id, item);
    prependCard(item);
    updateEmpty();
  } else {
    item.encryptedBinaryChunks ||= new Array(totalChunks).fill(null);
    item.totalEncryptedChunks = totalChunks || item.totalEncryptedChunks;
  }
  return item;
}

function storeEncryptedBinaryChunk(header, payload) {
  const item = ensureEncryptedBinaryPlaceholder(header.i, header.tc);
  item.encryptedBinaryChunks ||= new Array(header.tc).fill(null);
  if (item.encryptedBinaryChunks[header.ci] === null) {
    item.encryptedBinaryChunks[header.ci] = payload.slice(0);
    item.encryptedChunkIndexes ||= [];
    if (!item.encryptedChunkIndexes.includes(header.ci)) item.encryptedChunkIndexes.push(header.ci);
  }
  item.receivedEncryptedChunks = item.encryptedChunkIndexes.length;
  item.totalEncryptedChunks = header.tc;
  updateEncryptedPlaceholderCard(item);
  return item.receivedEncryptedChunks;
}

async function decryptStoredEncryptedBinaryChunks(item, key) {
  const chunks = item.encryptedBinaryChunks;
  if (!chunks?.length || chunks.some(chunk => chunk === null)) return;
  const itemId = item.encryptedMeta?.itemId || item.id.replace(/^encrypted-/, '');
  cardEncryptionKeys.set(itemId, key);
  for (let i = 0; i < chunks.length; i++) {
    const payload = chunks[i];
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(payload, 0, 12) },
      key,
      payload.slice(12)
    );
    handleBinaryFileChunk(itemId, i, chunks.length, plain);
  }
}

function addEncryptedPlaceholder(encryptedData, meta = {}) {
  const groupId = encryptedPlaceholderId(meta);
  const message = { data: encryptedData, meta, seq: encryptedMessageSeq++ };
  const existing = items.get(groupId);
  if (existing?.type === 'encrypted') {
    existing.encryptedMessages.push(message);
    existing.encryptedMeta = { ...existing.encryptedMeta, ...meta };
    if (meta.addedAt) {
      existing.addedAt = meta.addedAt;
      const timeEl = document.querySelector(`#card-${existing.id} .card-time`);
      if (timeEl) timeEl.dataset.addedAt = meta.addedAt;
      refreshCardTimes();
    }
    if (meta.payloadType === 'file_chunk') {
      existing.totalEncryptedChunks = meta.totalChunks || existing.totalEncryptedChunks;
      existing.encryptedChunkIndexes ||= [];
      if (!existing.encryptedChunkIndexes.includes(meta.chunkIndex)) {
        existing.encryptedChunkIndexes.push(meta.chunkIndex);
      }
      existing.receivedEncryptedChunks = existing.encryptedChunkIndexes.length;
    }
    updateEncryptedPlaceholderCard(existing);
    return;
  }

  const item = {
    id: groupId,
    type: 'encrypted',
    encryptedMeta: meta,
    encryptedMessages: [message],
    encryptedChunkIndexes: meta.payloadType === 'file_chunk' ? [meta.chunkIndex] : [],
    receivedEncryptedChunks: meta.payloadType === 'file_chunk' ? 1 : 0,
    totalEncryptedChunks: meta.payloadType === 'file_chunk' ? meta.totalChunks : undefined,
    encrypted: true,
    addedAt: meta.addedAt || Date.now()
  };
  items.set(item.id, item);
  prependCard(item);
  updateEmpty();
}

async function enterPasswordForEncryptedCard(id) {
  openPassphraseModal(id);
}

async function openEncryptedCardWithPassphrase(id, passphrase) {
  const item = items.get(id);
  if (!item || item.type !== 'encrypted') return;

  try {
    const key = await deriveKey(passphrase, token);
    await unlockEncryptedCard(item, key);
    closePassphraseModal();
    showToast('Encrypted card unlocked');
  } catch {
    showToast('Could not decrypt with that password.');
  }
}

function connectDataWS() {
  if (!token || !ws || ws.readyState !== WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}/ws/${encodeURIComponent(token)}?clientId=${clientId}&channel=data`;
  if (dataWs) { dataWs.onclose = null; dataWs.close(); dataWs = null; }
  dataWs = new WebSocket(url);
  dataWs.binaryType = 'arraybuffer';
  dataWs.onopen = () => {
    dataWsRetryDelay = 1000;
    debugLog('data-socket-open');
  };
  dataWs.onmessage = async e => {
    try {
      if (e.data instanceof ArrayBuffer) {
        handleBinaryMessage(e.data);
      } else {
        await handleServerMessage(JSON.parse(e.data));
      }
    } catch { }
  };
  dataWs.onclose = () => {
    debugLog('data-socket-closed');
    if (!token || !ws || ws.readyState !== WebSocket.OPEN) return;
    dataWsRetryTimer = setTimeout(connectDataWS, dataWsRetryDelay);
    dataWsRetryDelay = Math.min(dataWsRetryDelay * 2, 30000);
  };
  dataWs.onerror = () => debugLog('data-socket-error');
}

async function connectWS() {
  if (!token) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  let url = `${protocol}://${location.host}/ws/${encodeURIComponent(token)}?clientId=${clientId}&channel=control`;
  const passphrase = currentPassphrase || localStorage.getItem('clipshare_passphrase');
  encryptionKey = null;
  encryptionEnabled = false;
  if (passphrase) {
    currentPassphrase = passphrase;
    encryptionKey = await deriveKey(currentPassphrase, token);
  }
  updateEncryptionControl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    wsRetryDelay = 1000;
    setDot('connected');
    connectDataWS();
  };
  ws.onmessage = async e => {
    try {
      const msg = JSON.parse(e.data);
      await handleServerMessage(msg);
    } catch { }
  };
  ws.onclose = () => {
    setDot('disconnected');
    if (dataWs) { dataWs.onclose = null; dataWs.close(); dataWs = null; }
    if (dataWsRetryTimer) { clearTimeout(dataWsRetryTimer); dataWsRetryTimer = null; }
    wsRetryTimer = setTimeout(connectWS, wsRetryDelay);
    wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
  };
  ws.onerror = () => setDot('error');
}

function setDot(state) {
  const dot = document.getElementById('ws-dot');
  dot.className = 'ws-dot' + (state === 'connected' ? ' connected' : state === 'error' ? ' error' : '');
  dot.title = state === 'connected' ? 'Connected to relay' : state === 'error' ? 'Connection error' : 'Reconnecting to relay';
}

function sendPriorityJson(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

function sendDataJson(msg) {
  if (!dataWs || dataWs.readyState !== WebSocket.OPEN) return false;
  dataWs.send(JSON.stringify(msg));
  return true;
}

async function wsSend(msg, keyOverride = null, priority = false, useDataSocket = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const key = arguments.length > 1 ? keyOverride : encryptionKey;
  const sendJson = useDataSocket ? sendDataJson : sendPriorityJson;
  if (key) {
    const jsonStr = JSON.stringify(msg);
    const encrypted = await encryptMessage(jsonStr, key);
    const envelope = { type: 'encrypted', data: encrypted, meta: encryptedMetaForMessage(msg) };
    if (priority || useDataSocket) sendJson(envelope);
    else ws.send(JSON.stringify(envelope));
  } else {
    if (priority || useDataSocket) sendJson(msg);
    else ws.send(JSON.stringify(msg));
  }
}

// ── Message handling ─────────────────────────────────────────────────
async function handleServerMessage(msg) {
  if (msg.type === 'welcome') {
    clientCount = msg.peerCount + 1;
    connectedPeers.clear();
    peerCardMetadata.clear();
    peerCounter = 0;
    selfPeerInfo = { label: String(msg.selfPeerNumber || 1), ip: msg.clientIp || '' };
    (msg.peerInfos || []).forEach(peer => {
      const peerId = peer.clientId;
      if (peerId === clientId) return;
      peerCounter = Math.max(peerCounter, Number(peer.peerNumber) || peerCounter + 1);
      connectedPeers.set(peerId, { label: String(peer.peerNumber || peerCounter), ip: peer.ip || '' });
    });
    seedPeerMetadataFromSources(msg.sources || []);
    updatePeerCount();
    encryptionEnabled = !!msg.encrypted;
    if ((msg.sources || []).length && !items.size) autoSelectSyncSource(msg.sources);
  } else if (msg.type === 'peer_joined') {
    clientCount++;
    peerCounter = Math.max(peerCounter + 1, Number(msg.peerNumber) || 0);
    connectedPeers.set(msg.clientId, { label: String(msg.peerNumber || peerCounter), ip: msg.ip || '' });
    updatePeerCount();
  } else if (msg.type === 'peer_left') {
    clientCount = Math.max(1, clientCount - 1);
    connectedPeers.delete(msg.clientId);
    peerCardMetadata.delete(msg.clientId);
    for (const [itemId, peerMap] of outboundTransfers) {
      if (peerMap.has(msg.clientId)) {
        peerMap.delete(msg.clientId);
        if (peerMap.size === 0) outboundTransfers.delete(itemId);
        refreshOutboundUI(itemId);
      }
    }
    updatePeerCount();
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
  } else if (msg.type === 'metadata_updated') {
    debugLog(msg.senderId === clientId ? 'announce-stored' : 'metadata-updated', {
      senderId: msg.senderId,
      itemId: msg.itemId,
      action: msg.action,
      stored: msg.stored,
    });
    applyPeerMetadataUpdate(msg);
  } else if (msg.type === 'metadata_snapshot') {
    debugLog('foreground-check-snapshot', { sources: msg.sources?.length || 0 });
    seedPeerMetadataFromSources(msg.sources || []);
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
    syncMissingFromSources(msg.sources || []);
  } else if (msg.type === 'relay') {
    handlePayload(msg.payload, false, null, msg.senderId);
  } else if (msg.type === 'encrypted') {
    if (msg.meta?.payloadType === 'item_deleted') {
      forgetPeerCardMetadata(msg.senderId, msg.meta.itemId);
    } else {
      rememberPeerCardMetadata(msg.senderId, cardMetadataFromEncryptedMeta(msg.meta));
    }
    if (encryptionKey) {
      try {
        await applyEncryptedMessage(msg.data, encryptionKey, msg.senderId);
        if (msg.meta?.itemId) cardEncryptionKeys.set(msg.meta.itemId, encryptionKey);
      } catch {
        try {
          if (await applyEncryptedWithRememberedKey(msg)) return;
        } catch { }
        addEncryptedPlaceholder(msg.data, msg.meta);
      }
    } else {
      try {
        if (await applyEncryptedWithRememberedKey(msg)) return;
      } catch { }
      addEncryptedPlaceholder(msg.data, msg.meta);
    }
  }
}

function markEncrypted(item) {
  return item ? { ...item, encrypted: true } : item;
}

function handlePayload(payload, receivedEncrypted = false, payloadKey = null, senderId = null) {
  if (!payload) return;

  if (payload.type === 'sync_state') {
    debugLog('retrieve-sync-state', { senderId, items: payload.items?.length || 0, encrypted: receivedEncrypted });
    if (senderId) {
      const cards = new Map();
      (payload.items || []).forEach(item => {
        const meta = cardMetadataFromItem(receivedEncrypted ? markEncrypted(item) : item);
        if (meta) cards.set(meta.id, meta);
      });
      peerCardMetadata.set(senderId, cards);
    }
    (payload.items || []).forEach(item => {
      if (!items.has(item.id)) {
        if (receivedEncrypted && payloadKey) cardEncryptionKeys.set(item.id, payloadKey);
        items.set(item.id, receivedEncrypted ? markEncrypted(item) : item);
      }
    });
    renderAll();

  } else if (payload.type === 'sync_request') {
    debugLog('retrieve-request-received', { requesterId: payload.requesterId });
    sendSyncState(payload.requesterId);

  } else if (payload.type === 'item_added') {
    const item = receivedEncrypted ? markEncrypted(payload.item) : payload.item;
    debugLog('retrieve-card-metadata', { senderId, itemId: item?.id, type: item?.type, filename: item?.filename, size: item?.size, encrypted: !!item?.encrypted });
    rememberPeerCardMetadata(senderId, cardMetadataFromItem(item));
    if (item && !items.has(item.id)) {
      if (receivedEncrypted && payloadKey) cardEncryptionKeys.set(item.id, payloadKey);
      items.set(item.id, item);
      prependCard(item);
      updateEmpty();
    }

  } else if (payload.type === 'item_deleted') {
    forgetPeerCardMetadata(senderId, payload.itemId);
    const hadItem = items.delete(payload.itemId);
    if (hadItem) publishClientCardRemoval(payload.itemId, 'remote-delete');
    cardEncryptionKeys.delete(payload.itemId);
    fileTransfers.delete(payload.itemId);
    chunkScheduler.cancelItem(payload.itemId);
    outboundTransfers.delete(payload.itemId);
    removeCardAnimated(payload.itemId, updateEmpty);

  } else if (payload.type === 'item_updated') {
    const peerCards = senderId ? peerCardMetadata.get(senderId) : null;
    const peerMeta = peerCards?.get(payload.itemId);
    if (peerMeta) peerMeta.updatedAt = Date.now();
    if (receivedEncrypted && payloadKey) cardEncryptionKeys.set(payload.itemId, payloadKey);
    const item = items.get(payload.itemId);
    if (!item || item.type !== 'text') return;
    item.content = payload.content;
    const el = document.querySelector(`#card-${payload.itemId} .text-content`);
    if (el && document.activeElement !== el) el.innerText = payload.content;

  } else if (payload.type === 'file_chunk') {
    if (receivedEncrypted && payloadKey) cardEncryptionKeys.set(payload.itemId, payloadKey);
    handleFileChunk(payload, senderId);
  } else if (payload.type === 'chunk_ack') {
    handleChunkAck(payload.itemId, payload.totalChunks, payload.peerId, payload.receivedChunks);
  }
}

// ── Sync ─────────────────────────────────────────────────────────────
function sendSyncState(targetClientId) {
  const sendableItems = [...items.values()].filter(i =>
    i.type === 'text' || i.rawBuffer || (i.dataUrl && i.dataUrl.startsWith('data:'))
  );
  debugLog('retrieve-send-state', { targetClientId, items: sendableItems.length });
  sendableItems.forEach(item => {
    const cardKey = cardEncryptionKeys.get(item.id);
    debugLog('starting', { itemId: item.id, targetClientId, type: item.type, filename: item.filename, size: item.size, encrypted: !!cardKey, source: 'sync' });
    if (item.type === 'text') {
      wsSend({ type: 'relay', targetId: targetClientId, payload: { type: 'item_added', item } }, cardKey, true);
      return;
    }
    // Send item metadata (no binary payload)
    const { dataUrl, rawBuffer, ...meta } = item;
    wsSend({ type: 'relay', targetId: targetClientId, payload: { type: 'item_added', item: meta } }, cardKey, true);

    if (cardKey && item.rawBuffer) {
      sendFileChunksBinaryEncrypted(item, cardKey, targetClientId); // encrypted binary path
    } else if (cardKey) {
      sendFileChunks(item, cardKey, targetClientId); // encrypted data-url chunks
    } else if (item.rawBuffer) {
      // Binary: send only the chunks this peer missed
      const broadcast = activeBroadcasts.get(item.id);
      if (broadcast && broadcast.nextChunk > 0) {
        // Chunks 0..nextChunk-1 were already broadcast before peer joined;
        // send them directly. The ongoing broadcast covers nextChunk..total.
        sendFileChunksBinaryRange(item, targetClientId, 0, broadcast.nextChunk);
      } else if (!broadcast) {
        // No active broadcast — send everything directly
        sendFileChunksBinary(item, targetClientId);
      }
      // If broadcast.nextChunk === 0: peer joined right at the start, broadcast covers all
    }
  });
}

// ── Adding items ─────────────────────────────────────────────────────
async function paste() {
  try {
    const clipItems = await navigator.clipboard.read();
    for (const ci of clipItems) {
      const imageType = ci.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await ci.getType(imageType);
        if (blob.size > MAX_FILE_BYTES) { showToast('Clipboard image exceeds the 128 MB limit'); return; }
        const item = { id: randomUUID(), type: 'image', filename: 'clipboard-image.' + imageType.split('/')[1], mimeType: imageType, size: blob.size, addedAt: Date.now() };
        item.rawBuffer = await blob.arrayBuffer();
        item.dataUrl = URL.createObjectURL(blob);
        await prepareImageThumbnail(item, blob);
        addAndBroadcast(item);
        return;
      }
      if (ci.types.includes('text/plain')) {
        const blob = await ci.getType('text/plain');
        const content = await blob.text();
        if (content) { addAndBroadcast({ id: randomUUID(), type: 'text', content, addedAt: Date.now() }); return; }
      }
    }
  } catch {
    try {
      const content = await navigator.clipboard.readText();
      if (content) addAndBroadcast({ id: randomUUID(), type: 'text', content, addedAt: Date.now() });
    } catch (err) {
      showToast('Could not read clipboard: ' + (err.message || err));
    }
  }
}

const MAX_FILE_BYTES = 128 * 1024 * 1024;

async function handleFiles(files) {
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      showToast(`"${file.name}" exceeds the 128 MB limit`);
      continue;
    }
    const itemType = file.type.startsWith('image/') ? 'image' : 'file';
    const item = { id: randomUUID(), type: itemType, filename: file.name, mimeType: file.type, size: file.size, addedAt: Date.now() };
    item.rawBuffer = await file.arrayBuffer();
    item.dataUrl = URL.createObjectURL(file);
    await prepareImageThumbnail(item, file);
    addAndBroadcast(item);
  }
}

function createTextCard() {
  const item = { id: randomUUID(), type: 'text', content: '', addedAt: Date.now() };
  addAndBroadcast(item);
  requestAnimationFrame(() => {
    const el = document.querySelector(`#card-${item.id} .text-content`);
    if (el) el.focus();
  });
}

function addAndBroadcast(item) {
  item.encrypted = !!encryptionKey;
  const itemKey = item.encrypted ? encryptionKey : null;
  if (itemKey) cardEncryptionKeys.set(item.id, itemKey);
  items.set(item.id, item);
  prependCard(item);
  updateEmpty();
  debugLog('starting', { itemId: item.id, type: item.type, filename: item.filename, size: item.size, encrypted: !!itemKey, source: 'broadcast' });

  if (item.type === 'text') {
    wsSend({ type: 'relay', payload: { type: 'item_added', item } }, itemKey, true);
  } else {
    // Strip local-only fields before broadcasting item metadata
    const { dataUrl, rawBuffer, ...meta } = item;
    wsSend({ type: 'relay', payload: { type: 'item_added', item: meta } }, itemKey, true);
    if (itemKey && item.rawBuffer) {
      sendFileChunksBinaryEncrypted(item, itemKey); // encrypted binary path
    } else if (itemKey || !item.rawBuffer) {
      sendFileChunks(item, itemKey); // data-url chunks
    } else {
      sendFileChunksBinary(item, null); // broadcast binary chunks
    }
  }
}

// ── Chunked file sending (data-url path) ────────────────────────────

async function* fileChunkGenerator(item, keyOverride, targetClientId, onProgress) {
  // Get base64 content: from dataUrl (base64 form) only — rawBuffer items use binary path
  const dataUrl = item.dataUrl && item.dataUrl.startsWith('data:') ? item.dataUrl : null;
  if (!dataUrl) return;
  const comma = dataUrl.indexOf(',');
  const prefix = dataUrl.slice(0, comma + 1);
  const b64 = dataUrl.slice(comma + 1);
  const totalChunks = Math.ceil(b64.length / CHUNK_SIZE) || 1;
  debugLog('starting', { itemId: item.id, targetClientId: targetClientId || 'broadcast', path: keyOverride ? 'encrypted-base64' : 'base64', totalChunks });

  for (let i = 0; i < totalChunks; i++) {
    if (!items.has(item.id)) return;
    if (!await waitForDataWS()) return;
    await drainWS();
    await wsSend({
      type: 'relay',
      targetId: targetClientId || undefined,
      payload: {
        type: 'file_chunk',
        itemId: item.id,
        chunkIndex: i,
        totalChunks,
        ...(i === 0 ? { prefix } : {}),
        data: b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      },
    }, keyOverride, false, true);
    onProgress(i + 1, totalChunks);
    debugProgress('progress-send', item.id, i + 1, totalChunks, { targetClientId: targetClientId || 'broadcast', path: keyOverride ? 'encrypted-base64' : 'base64' });
    yield;
  }
  debugLog('finish-send', { itemId: item.id, targetClientId: targetClientId || 'broadcast', path: keyOverride ? 'encrypted-base64' : 'base64', totalChunks });
}

function sendFileChunks(item, keyOverride = null, targetClientId = null) {
  if (targetClientId) {
    // Targeted send — single row
    const onProgress = clientCount > 1 ? makeOutboundProgress(item.id, targetClientId) : () => {};
    chunkScheduler.enqueue(item.id, -(item.size || 0),
      () => fileChunkGenerator(item, keyOverride, targetClientId, onProgress));
    return;
  }

  // Broadcast — one row per peer
  const peerIds = [...connectedPeers.keys()];
  if (!peerIds.length) {
    chunkScheduler.enqueue(item.id, item.size || 0,
      () => fileChunkGenerator(item, keyOverride, null, () => {}));
    return;
  }

  if (!outboundTransfers.has(item.id)) outboundTransfers.set(item.id, new Map());
  const peerMap = outboundTransfers.get(item.id);
  for (const pid of peerIds) peerMap.set(pid, { sent: 0, total: 0, startTime: Date.now() });
  refreshOutboundUI(item.id);

  const onProgress = (sent, total) => {
    const pm = outboundTransfers.get(item.id);
    for (const pid of peerIds) {
      const p = pm?.get(pid);
      if (p) { p.sent = sent; p.total = total; }
      updateOutboundRow(item.id, pid, sent, total);
    }
    if (sent >= total) {
      setTimeout(() => {
        const pm = outboundTransfers.get(item.id);
        if (pm) { for (const pid of peerIds) pm.delete(pid); if (!pm.size) outboundTransfers.delete(item.id); }
        refreshOutboundUI(item.id);
      }, 1500);
    }
  };

  chunkScheduler.enqueue(item.id, item.size || 0,
    () => fileChunkGenerator(item, keyOverride, null, onProgress));
}

// ── Chunked file sending (binary path) ──────────────────────────────

async function drainWS() {
  // Pace sending to match actual network throughput so the sender's
  // progress bar stays in sync with the receiver's.
  const highWater = BINARY_CHUNK_SIZE * 2;
  const start = Date.now();
  while (dataWs && dataWs.readyState === WebSocket.OPEN && dataWs.bufferedAmount > highWater) {
    await new Promise(r => setTimeout(r, 8));
    if (Date.now() - start > 10000) break;
  }
}

async function waitForDataWS() {
  if (dataWs && dataWs.readyState === WebSocket.OPEN) return true;
  if (!dataWs || dataWs.readyState === WebSocket.CLOSED) connectDataWS();
  const start = Date.now();
  while (dataWs && dataWs.readyState === WebSocket.CONNECTING) {
    await new Promise(r => setTimeout(r, 20));
    if (Date.now() - start > 5000) break;
  }
  return !!dataWs && dataWs.readyState === WebSocket.OPEN;
}

function buildBinaryFrame(targetId, itemId, chunkIndex, totalChunks, chunkBytes) {
  const header = { t: 'fc', i: itemId, ci: chunkIndex, tc: totalChunks, sid: clientId };
  if (targetId) header.tid = targetId;
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const frame = new Uint8Array(4 + headerBytes.length + chunkBytes.length);
  new DataView(frame.buffer).setUint32(0, headerBytes.length, false);
  frame.set(headerBytes, 4);
  frame.set(chunkBytes, 4 + headerBytes.length);
  return frame.buffer;
}

function makeOutboundProgress(itemId, trackKey) {
  if (!outboundTransfers.has(itemId)) outboundTransfers.set(itemId, new Map());
  outboundTransfers.get(itemId).set(trackKey, { sent: 0, total: 0, startTime: Date.now() });
  refreshOutboundUI(itemId);
  return (sent, total) => {
    const peerMap = outboundTransfers.get(itemId);
    const p = peerMap?.get(trackKey);
    if (p) { p.sent = sent; p.total = total; }
    updateOutboundRow(itemId, trackKey, sent, total);
    if (sent >= total) {
      setTimeout(() => {
        const pm = outboundTransfers.get(itemId);
        if (pm) { pm.delete(trackKey); if (!pm.size) outboundTransfers.delete(itemId); }
        refreshOutboundUI(itemId);
      }, 1500);
    }
  };
}

async function* fileChunkGeneratorBinary(item, targetId, onProgress) {
  if (!item.rawBuffer) return;
  const buf = item.rawBuffer;
  const totalChunks = Math.ceil(buf.byteLength / BINARY_CHUNK_SIZE) || 1;
  const isBroadcast = !targetId;
  onProgress(0, totalChunks); // initialise outbound row; bar advances via ACKs
  debugLog('starting', { itemId: item.id, targetId: targetId || 'broadcast', path: 'binary', totalChunks, bytes: buf.byteLength });

  for (let i = 0; i < totalChunks; i++) {
    if (!items.has(item.id)) { if (isBroadcast) activeBroadcasts.delete(item.id); return; }
    if (!await waitForDataWS()) return;
    await drainWS();
    const start = i * BINARY_CHUNK_SIZE;
    const chunk = new Uint8Array(buf, start, Math.min(BINARY_CHUNK_SIZE, buf.byteLength - start));
    if (dataWs && dataWs.readyState === WebSocket.OPEN) dataWs.send(buildBinaryFrame(targetId, item.id, i, totalChunks, chunk));
    if (isBroadcast) activeBroadcasts.set(item.id, { nextChunk: i + 1, totalChunks });
    debugProgress('progress-send', item.id, i + 1, totalChunks, { targetId: targetId || 'broadcast', path: 'binary' });
    yield;
  }
  if (isBroadcast) activeBroadcasts.delete(item.id);
  debugLog('finish-send', { itemId: item.id, targetId: targetId || 'broadcast', path: 'binary', totalChunks });
}

async function* fileChunkGeneratorBinaryRange(item, targetId, fromChunk, toChunk, onProgress) {
  if (!item.rawBuffer) return;
  const buf = item.rawBuffer;
  const totalChunks = Math.ceil(buf.byteLength / BINARY_CHUNK_SIZE) || 1;
  const end = Math.min(toChunk, totalChunks);
  onProgress(0, end - fromChunk); // initialise outbound row; bar advances via ACKs
  debugLog('starting', { itemId: item.id, targetId, path: 'binary-range', fromChunk, toChunk: end, totalChunks });

  for (let i = fromChunk; i < end; i++) {
    if (!items.has(item.id)) return;
    if (!await waitForDataWS()) return;
    await drainWS();
    const start = i * BINARY_CHUNK_SIZE;
    const chunk = new Uint8Array(buf, start, Math.min(BINARY_CHUNK_SIZE, buf.byteLength - start));
    if (dataWs && dataWs.readyState === WebSocket.OPEN) dataWs.send(buildBinaryFrame(targetId, item.id, i, totalChunks, chunk));
    debugProgress('progress-send', item.id, i + 1, totalChunks, { targetId, path: 'binary-range' });
    yield;
  }
  debugLog('finish-send', { itemId: item.id, targetId, path: 'binary-range', fromChunk, toChunk: end, totalChunks });
}

function sendFileChunksBinary(item, targetId) {
  if (targetId) {
    // Targeted send to one peer — single progress row
    const onProgress = clientCount > 1 ? makeOutboundProgress(item.id, targetId) : () => {};
    chunkScheduler.enqueue(item.id, -(item.size || 0),
      () => fileChunkGeneratorBinary(item, targetId, onProgress));
    return;
  }

  // Broadcast — one progress row per currently connected peer
  const peerIds = [...connectedPeers.keys()];
  if (!peerIds.length) {
    chunkScheduler.enqueue(item.id, item.size || 0,
      () => fileChunkGeneratorBinary(item, null, () => {}));
    return;
  }

  if (!outboundTransfers.has(item.id)) outboundTransfers.set(item.id, new Map());
  const peerMap = outboundTransfers.get(item.id);
  for (const pid of peerIds) peerMap.set(pid, { sent: 0, total: 0, startTime: Date.now() });
  refreshOutboundUI(item.id);

  const onProgress = (sent, total) => {
    const pm = outboundTransfers.get(item.id);
    for (const pid of peerIds) {
      const p = pm?.get(pid);
      if (p) { p.sent = sent; p.total = total; }
      updateOutboundRow(item.id, pid, sent, total);
    }
    if (sent >= total) {
      setTimeout(() => {
        const pm = outboundTransfers.get(item.id);
        if (pm) { for (const pid of peerIds) pm.delete(pid); if (!pm.size) outboundTransfers.delete(item.id); }
        refreshOutboundUI(item.id);
      }, 1500);
    }
  };

  chunkScheduler.enqueue(item.id, item.size || 0,
    () => fileChunkGeneratorBinary(item, null, onProgress));
}

function sendFileChunksBinaryRange(item, targetId, fromChunk, toChunk) {
  if (fromChunk >= toChunk) return;
  const hasPeers = clientCount > 1;
  const onProgress = hasPeers ? makeOutboundProgress(item.id, targetId) : () => {};
  // High priority (negative) so catch-up to new peer runs before broadcast continues
  chunkScheduler.enqueue(item.id, -(item.size || 0),
    () => fileChunkGeneratorBinaryRange(item, targetId, fromChunk, toChunk, onProgress));
}

// ── Chunked file sending (encrypted binary path) ─────────────────────

async function* fileChunkGeneratorBinaryEncrypted(item, key, targetId, onProgress) {
  if (!item.rawBuffer) return;
  const buf = item.rawBuffer;
  const totalChunks = Math.ceil(buf.byteLength / BINARY_CHUNK_SIZE) || 1;
  onProgress(0, totalChunks); // initialise outbound row; bar advances via ACKs
  debugLog('starting', { itemId: item.id, targetId: targetId || 'broadcast', path: 'encrypted-binary', totalChunks, bytes: buf.byteLength });

  for (let i = 0; i < totalChunks; i++) {
    if (!items.has(item.id)) return;
    if (!await waitForDataWS()) return;
    await drainWS();
    const start = i * BINARY_CHUNK_SIZE;
    const chunkBytes = new Uint8Array(buf, start, Math.min(BINARY_CHUNK_SIZE, buf.byteLength - start));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, chunkBytes));

    const header = { t: 'efc', i: item.id, ci: i, tc: totalChunks, sid: clientId };
    if (targetId) header.tid = targetId;
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const frame = new Uint8Array(4 + headerBytes.length + 12 + ciphertext.length);
    new DataView(frame.buffer).setUint32(0, headerBytes.length, false);
    frame.set(headerBytes, 4);
    frame.set(iv, 4 + headerBytes.length);
    frame.set(ciphertext, 4 + headerBytes.length + 12);

    if (dataWs && dataWs.readyState === WebSocket.OPEN) dataWs.send(frame.buffer);
    debugProgress('progress-send', item.id, i + 1, totalChunks, { targetId: targetId || 'broadcast', path: 'encrypted-binary' });
    yield;
  }
  debugLog('finish-send', { itemId: item.id, targetId: targetId || 'broadcast', path: 'encrypted-binary', totalChunks });
}

function sendFileChunksBinaryEncrypted(item, key, targetId) {
  if (targetId) {
    const onProgress = clientCount > 1 ? makeOutboundProgress(item.id, targetId) : () => {};
    chunkScheduler.enqueue(item.id, -(item.size || 0),
      () => fileChunkGeneratorBinaryEncrypted(item, key, targetId, onProgress));
    return;
  }

  const peerIds = [...connectedPeers.keys()];
  if (!peerIds.length) {
    chunkScheduler.enqueue(item.id, item.size || 0,
      () => fileChunkGeneratorBinaryEncrypted(item, key, null, () => {}));
    return;
  }

  if (!outboundTransfers.has(item.id)) outboundTransfers.set(item.id, new Map());
  const peerMap = outboundTransfers.get(item.id);
  for (const pid of peerIds) peerMap.set(pid, { sent: 0, total: 0, startTime: Date.now() });
  refreshOutboundUI(item.id);

  const onProgress = (sent, total) => {
    const pm = outboundTransfers.get(item.id);
    for (const pid of peerIds) {
      const p = pm?.get(pid);
      if (p) { p.sent = sent; p.total = total; }
      updateOutboundRow(item.id, pid, sent, total);
    }
    if (sent >= total) {
      setTimeout(() => {
        const pm = outboundTransfers.get(item.id);
        if (pm) { for (const pid of peerIds) pm.delete(pid); if (!pm.size) outboundTransfers.delete(item.id); }
        refreshOutboundUI(item.id);
      }, 1500);
    }
  };

  chunkScheduler.enqueue(item.id, item.size || 0,
    () => fileChunkGeneratorBinaryEncrypted(item, key, null, onProgress));
}

// ── Chunked file receiving (binary path) ────────────────────────────

function handleBinaryMessage(buffer) {
  if (buffer.byteLength < 4) return;
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, false);
  if (buffer.byteLength < 4 + headerLen) return;
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLen)));
  } catch { return; }
  if (header.t === 'efc') {
    const key = cardEncryptionKeys.get(header.i) || encryptionKey;
    const payload = buffer.slice(4 + headerLen);
    const sid = header.sid;
    if (!key) {
      const receivedChunks = storeEncryptedBinaryChunk(header, payload);
      sendChunkAck(header.i, header.tc, sid, receivedChunks);
      return;
    }
    crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload, 0, 12) }, key, payload.slice(12))
      .then(plain => {
        const receivedChunks = handleBinaryFileChunk(header.i, header.ci, header.tc, plain, sid);
        sendChunkAck(header.i, header.tc, sid, receivedChunks);
      })
      .catch(() => {
        const receivedChunks = storeEncryptedBinaryChunk(header, payload);
        sendChunkAck(header.i, header.tc, sid, receivedChunks);
      });
    return;
  }
  if (header.t !== 'fc') return;
  // Copy chunk data into its own buffer so the outer ArrayBuffer can be GC'd
  const chunkData = buffer.slice(4 + headerLen);
  const receivedChunks = handleBinaryFileChunk(header.i, header.ci, header.tc, chunkData, header.sid);
  sendChunkAck(header.i, header.tc, header.sid, receivedChunks);
}

function sendChunkAck(itemId, totalChunks, senderId, receivedChunks) {
  if (!senderId || !ws || ws.readyState !== WebSocket.OPEN) return;
  debugProgress('progress-ack-send', itemId, receivedChunks, totalChunks, { senderId });
  sendPriorityJson({
    type: 'relay',
    targetId: senderId,
    payload: { type: 'chunk_ack', itemId, totalChunks, receivedChunks, peerId: clientId },
  });
}

function handleChunkAck(itemId, totalChunks, peerId, receivedChunks) {
  const pm = outboundTransfers.get(itemId);
  const p = pm?.get(peerId);
  if (!p) return;
  if (!p.total) p.total = totalChunks;
  if (!Number.isFinite(receivedChunks)) return;
  p.acked = Math.min(Math.max(receivedChunks, p.acked || 0), p.total);
  p.sent = p.acked;
  debugProgress('progress-ack-received', itemId, p.sent, p.total, { peerId });
  updateOutboundRow(itemId, peerId, p.sent, p.total);
  if (p.sent >= p.total) {
    setTimeout(() => {
      const pm = outboundTransfers.get(itemId);
      if (pm) { pm.delete(peerId); if (!pm.size) outboundTransfers.delete(itemId); }
      refreshOutboundUI(itemId);
    }, 1500);
  }
}

function handleBinaryFileChunk(itemId, chunkIndex, totalChunks, chunkBuffer, senderId) {
  if (!binaryTransfers.has(itemId)) {
    binaryTransfers.set(itemId, { chunks: new Array(totalChunks).fill(null), received: 0, totalChunks, senderId, startTime: Date.now() });
    debugLog('starting', { itemId, path: 'receive-binary', totalChunks });
  }
  const t = binaryTransfers.get(itemId);
  if (t.chunks[chunkIndex] === null) {
    t.chunks[chunkIndex] = chunkBuffer;
    t.received++;
  }
  debugProgress('progress-receive', itemId, t.received, t.totalChunks, { path: 'binary' });
  updateTransferProgress(itemId, t.received / t.totalChunks, t);
  if (t.received === t.totalChunks) {
    binaryTransfers.delete(itemId);
    finalizeTransferBinary(itemId, t.chunks);
  }
  return t.received;
}

async function finalizeTransferBinary(itemId, chunks) {
  const item = items.get(itemId);
  if (!item) return;
  debugLog('finish', { itemId, path: 'binary', filename: item.filename, chunks: chunks.length });
  const totalBytes = chunks.reduce((s, c) => s + c.byteLength, 0);
  const assembled = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { assembled.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
  const blob = new Blob([assembled], { type: item.mimeType || 'application/octet-stream' });
  item.rawBuffer = assembled.buffer;
  item.dataUrl = URL.createObjectURL(blob);
  await prepareImageThumbnail(item, blob);
  publishClientCardMetadata(item);
  finalizeCardInPlace(item);
}

// ── Chunked file receiving (encrypted/base64 path) ───────────────────
function handleFileChunk({ itemId, chunkIndex, totalChunks, prefix, data }, senderId) {
  if (!fileTransfers.has(itemId)) {
    fileTransfers.set(itemId, { chunks: new Array(totalChunks).fill(null), received: 0, totalChunks, prefix: '', senderId, startTime: Date.now() });
    debugLog('starting', { itemId, path: 'receive-base64', totalChunks });
  }
  const t = fileTransfers.get(itemId);
  if (prefix) t.prefix = prefix;
  if (t.chunks[chunkIndex] === null) { t.chunks[chunkIndex] = data; t.received++; }

  debugProgress('progress-receive', itemId, t.received, t.totalChunks, { path: 'base64' });
  updateTransferProgress(itemId, t.received / t.totalChunks, t);

  if (t.received === t.totalChunks) {
    const dataUrl = t.prefix + t.chunks.join('');
    fileTransfers.delete(itemId);
    finalizeTransfer(itemId, dataUrl);
  }
}

function updateTransferProgress(itemId, fraction, transfer) {
  const card = document.getElementById('card-' + itemId);
  if (!card) return;
  const pct = Math.round(fraction * 100);

  let section = card.querySelector('.inbound-progress');
  if (!section) {
    const imap = buildPeerIdentityMap();
    const identity = transfer?.senderId ? imap.get(transfer.senderId) : null;
    const label = identity ? identity.fullName : 'Unknown';
    section = document.createElement('div');
    section.className = 'inbound-progress';
    section.innerHTML = `<div class="outbound-progress-title">Receiving…</div>
<div class="outbound-peer-row">
  <span class="outbound-peer-label">${escHtml(label)}</span>
  <div class="outbound-peer-progress"><div class="outbound-peer-fill" id="ib-fill-${itemId}" style="width:0%"></div></div>
  <span class="outbound-peer-eta" id="ib-eta-${itemId}">…</span>
</div>`;
    card.insertBefore(section, card.querySelector('.card-footer'));
    requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add('ip-visible')));
  }

  const fill = document.getElementById('ib-fill-' + itemId);
  if (fill) fill.style.width = pct + '%';
  const eta = document.getElementById('ib-eta-' + itemId);
  if (eta) eta.textContent = transfer ? formatETA(transfer.startTime, transfer.received, transfer.totalChunks) : (pct >= 100 ? 'Done' : '…');
}

function formatETA(startTime, sent, total) {
  if (!sent) return '...';
  const elapsed = Date.now() - startTime;
  const ms = Math.ceil((total - sent) * elapsed / sent);
  if (ms < 10000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function refreshOutboundUI(itemId) {
  const card = document.getElementById('card-' + itemId);
  if (!card) return;
  const peerMap = outboundTransfers.get(itemId);
  const existing = card.querySelector('.outbound-progress');
  if (!peerMap || !peerMap.size) {
    if (existing) {
      existing.classList.remove('op-visible');
      existing.addEventListener('transitionend', () => existing.remove(), { once: true });
    }
    return;
  }

  const section = document.createElement('div');
  section.className = 'outbound-progress';
  let html = '<div class="outbound-progress-title">Sending…</div>';
  for (const [key, p] of peerMap) {
    const identity = buildPeerIdentityMap().get(key);
    const label = identity?.fullName ?? '?';
    const pct = p.total ? Math.round(p.sent / p.total * 100) : 0;
    const etaText = pct >= 100 ? 'Done' : '...';
    html += `<div class="outbound-peer-row">
      <span class="outbound-peer-label">${escHtml(label)}</span>
      <div class="outbound-peer-progress"><div class="outbound-peer-fill" id="ob-fill-${itemId}-${key}" style="width:${pct}%"></div></div>
      <span class="outbound-peer-eta" id="ob-eta-${itemId}-${key}">${etaText}</span>
    </div>`;
  }
  section.innerHTML = html;
  if (existing) {
    section.classList.add('op-visible');
    existing.replaceWith(section);
  } else {
    card.insertBefore(section, card.querySelector('.card-footer'));
    requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add('op-visible')));
  }
}

function updateOutboundRow(itemId, key, sent, total) {
  const pct = total ? Math.round(sent / total * 100) : 0;
  const fill = document.getElementById(`ob-fill-${itemId}-${key}`);
  if (fill) fill.style.width = pct + '%';
  const eta = document.getElementById(`ob-eta-${itemId}-${key}`);
  if (!eta) return;
  if (pct >= 100) { eta.textContent = 'Done'; return; }
  const p = outboundTransfers.get(itemId)?.get(key);
  eta.textContent = p ? formatETA(p.startTime, sent, total) : '...';
}

async function finalizeTransfer(itemId, dataUrl) {
  const item = items.get(itemId);
  if (!item) return;
  debugLog('finish', { itemId, path: 'base64', filename: item.filename, bytes: dataUrl.length });
  item.dataUrl = dataUrl;
  if (item.type === 'image' && !isBrowserViewableImage(item.mimeType)) {
    const blob = await (await fetch(dataUrl)).blob();
    await prepareImageThumbnail(item, blob);
  }
  publishClientCardMetadata(item);
  finalizeCardInPlace(item);
}

// ── Text editing ─────────────────────────────────────────────────────
function onTextEdit(id, el) {
  const item = items.get(id);
  if (!item) return;
  item.content = el.innerText;
  clearTimeout(editTimers.get(id));
  editTimers.set(id, setTimeout(() => {
    flushTextUpdate(id);
  }, 180));
}

function flushTextUpdate(id) {
  const item = items.get(id);
  if (!item || item.type !== 'text') return;
  clearTimeout(editTimers.get(id));
  editTimers.delete(id);
  wsSend({ type: 'relay', payload: { type: 'item_updated', itemId: id, content: item.content } }, cardEncryptionKeys.get(id));
}

// ── Delete with animation ─────────────────────────────────────────────
function removeCardAnimated(id, done) {
  const el = document.getElementById('card-' + id);
  if (!el) { done?.(); return; }
  el.classList.add('removing');
  el.addEventListener('animationend', () => { el.remove(); done?.(); }, { once: true });
}

function deleteItem(id) {
  const item = items.get(id);
  items.delete(id);
  const cardKey = cardEncryptionKeys.get(id);
  cardEncryptionKeys.delete(id);
  fileTransfers.delete(id);
  binaryTransfers.delete(id);
  activeBroadcasts.delete(id);
  chunkScheduler.cancelItem(id);
  outboundTransfers.delete(id);
  publishClientCardRemoval(id, 'local-delete');
  if (item?.type !== 'encrypted' || cardKey) {
    wsSend({ type: 'relay', payload: { type: 'item_deleted', itemId: id } }, cardKey);
  }
  removeCardAnimated(id, updateEmpty);
}

// ── Rendering ────────────────────────────────────────────────────────
function renderAll() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  [...items.values()].sort((a, b) => b.addedAt - a.addedAt).forEach(item => container.appendChild(buildCard(item)));
  updateEmpty();
  refreshIcons();
}

function prependCard(item) {
  const container = document.getElementById('cards');
  container.insertBefore(buildCard(item), container.firstChild);
  refreshIcons();
}

function finalizeCardInPlace(item) {
  const card = document.getElementById('card-' + item.id);
  if (!card) return;

  const body = card.querySelector('.card-body');
  if (body) {
    const imagePreviewUrl = item.thumbnailDataUrl || (isBrowserViewableImage(item.mimeType) ? item.dataUrl : '');
    let bodyHtml;
    if (item.type === 'image' && imagePreviewUrl) {
      bodyHtml = `<div class="card-image"><img src="${escAttr(imagePreviewUrl)}" alt="${escAttr(item.filename || 'image')}"></div>`;
    } else {
      bodyHtml = `<div class="card-file">${fileTypeIcon(item.mimeType)}<div class="file-info">
  <div class="file-name" title="${escAttr(item.filename)}">${escHtml(item.filename)}</div>
  <div class="file-type">${fileTypeName(item.mimeType)}</div>
  <div class="file-size">${humanSize(item.size)}</div>
</div></div>`;
    }
    body.innerHTML = bodyHtml;
  }

  const footer = card.querySelector('.card-footer');
  if (footer && !footer.querySelector('[title="Download"]')) {
    const deleteBtn = footer.querySelector('[title="Delete"]');
    if (deleteBtn) {
      deleteBtn.insertAdjacentHTML('beforebegin',
        `<button class="btn-icon" title="Download" onclick="downloadItem('${item.id}')"><i data-lucide="download"></i></button>`);
    }
  }

  const progress = card.querySelector('.inbound-progress');
  if (progress) {
    progress.classList.remove('ip-visible');
    progress.addEventListener('transitionend', () => progress.remove(), { once: true });
  }

  refreshIcons();
}

function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-' + item.id;

  let bodyHtml = '';
  let footerActions = '';

  if (item.type === 'encrypted') {
    const chunkText = encryptedChunkStatus(item);
    const progressPct = item.totalEncryptedChunks
      ? Math.round(((item.receivedEncryptedChunks || 0) / item.totalEncryptedChunks) * 100)
      : 0;
    const progressDisplay = item.totalEncryptedChunks ? '' : 'display:none;';
    bodyHtml = `<div class="encrypted-card">
  <i data-lucide="lock"></i>
  <div class="file-info">
    <div class="file-name">Encrypted</div>
    <div class="file-type encrypted-status">${chunkText}</div>
    <div class="progress-wrap encrypted-progress-wrap" style="${progressDisplay}"><div class="progress-fill encrypted-progress" style="width:${progressPct}%"></div></div>
  </div>
</div>`;
    footerActions = `<button class="btn-secondary" onclick="enterPasswordForEncryptedCard('${item.id}')"><i data-lucide="key-round"></i> Open</button>`;

  } else if (item.type === 'text') {
    bodyHtml = `<div class="card-text">
  <div class="text-content" contenteditable="true" spellcheck="false"
       oninput="onTextEdit('${item.id}', this)"
       onblur="flushTextUpdate('${item.id}')">${escHtml(item.content)}</div>
</div>`;
    footerActions = `<button class="btn-icon" title="Copy" onclick="copyText('${item.id}')"><i data-lucide="copy"></i></button>`;

  } else if (item.type === 'image' && item.thumbnailDataUrl && !item.dataUrl) {
    bodyHtml = `<div class="card-image"><img src="${item.thumbnailDataUrl}" alt="${escAttr(item.filename || 'image')}"></div>`;

  } else if (item.dataUrl) {
    const imagePreviewUrl = item.thumbnailDataUrl || (isBrowserViewableImage(item.mimeType) ? item.dataUrl : '');
    if (item.type === 'image' && imagePreviewUrl) {
      bodyHtml = `<div class="card-image"><img src="${imagePreviewUrl}" alt="${escAttr(item.filename || 'image')}"></div>`;
    } else {
      bodyHtml = `<div class="card-file">${fileTypeIcon(item.mimeType)}<div class="file-info">
    <div class="file-name" title="${escAttr(item.filename)}">${escHtml(item.filename)}</div>
    <div class="file-type">${fileTypeName(item.mimeType)}</div>
    <div class="file-size">${humanSize(item.size)}</div>
  </div></div>`;
    }
    footerActions = `<button class="btn-icon" title="Download" onclick="downloadItem('${item.id}')"><i data-lucide="download"></i></button>`;

  } else {
    bodyHtml = `<div class="card-file">${fileTypeIcon(item.mimeType)}<div class="file-info">
  <div class="file-name" title="${escAttr(item.filename)}">${escHtml(item.filename)}</div>
  <div class="file-type">${fileTypeName(item.mimeType)}</div>
  <div class="file-size">${humanSize(item.size)}</div>
</div></div>`;
  }

  const encryptedIcon = item.encrypted ? '<i data-lucide="lock" title="Encrypted"></i>' : '';
  const addedAt = Number.isFinite(Number(item.addedAt)) ? Number(item.addedAt) : Date.now();

  card.innerHTML = `
<div class="card-body">${bodyHtml}</div>
<div class="card-footer">
  <span class="card-time" data-added-at="${addedAt}">${encryptedIcon}<span class="card-time-text">${timeAgo(addedAt)}</span></span>
  ${footerActions}
  <button class="btn-icon" title="Delete" onclick="deleteItem('${item.id}')"><i data-lucide="trash-2"></i></button>
</div>`;

  return card;
}

function updateEmpty() {
  const empty = document.getElementById('empty');
  const cards = document.getElementById('cards');
  const hasCards = cards.children.length > 0;
  empty.style.display = hasCards ? 'none' : 'flex';
  cards.style.display = hasCards ? 'block' : 'none';
}

// ── Clipboard / download ─────────────────────────────────────────────
async function copyText(id) {
  const item = items.get(id);
  if (!item) return;
  try {
    await navigator.clipboard.writeText(item.content);
    showToast('Copied to clipboard!');
  } catch {
    showToast('Could not copy — try HTTPS');
  }
}

function downloadItem(id) {
  const item = items.get(id);
  if (!item || !item.dataUrl) return;
  const a = document.createElement('a');
  a.href = item.dataUrl;
  a.download = item.filename || 'download';
  a.click();
}
