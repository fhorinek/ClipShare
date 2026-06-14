// ── Utilities ────────────────────────────────────────────────────────
const CLIENT_DIAGNOSTIC_BUILD = 'webrtc-existing-fix-v4';

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

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,:;!?)\]]/g;
function linkify(text) {
  const escaped = escHtml(String(text));
  return escaped.replace(URL_RE, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
}

function escAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cardElement(itemId) {
  return document.getElementById('card-' + itemId);
}

const ESTIMATED_MIME_BY_EXTENSION = {
  asm: 'text/assembly',
  bash: 'text/bash',
  bat: 'text/batch',
  bazel: 'text/starlark',
  bin: 'application/octet-stream',
  bzl: 'text/starlark',
  c: 'text/c',
  cc: 'text/c++',
  cfg: 'text/config',
  clj: 'text/clojure',
  cmake: 'text/cmake',
  conf: 'text/config',
  cpp: 'text/c++',
  cpio: 'application/cpio',
  cs: 'text/csharp',
  css: 'text/css',
  csv: 'text/csv',
  cxx: 'text/c++',
  dart: 'text/dart',
  db: 'application/vnd.sqlite3',
  deb: 'application/vnd.debian.binary-package',
  desktop: 'application/x-desktop',
  diff: 'text/patch',
  dmesg: 'text/plain',
  dockerfile: 'text/dockerfile',
  dwg: 'image/vnd.dwg',
  dxf: 'image/vnd.dxf',
  erl: 'text/erlang',
  ex: 'text/elixir',
  exs: 'text/elixir',
  f: 'text/fortran',
  f90: 'text/fortran',
  fish: 'text/fish',
  flatpak: 'application/vnd.flatpak',
  flatpakref: 'application/vnd.flatpak.ref',
  flatpakrepo: 'application/vnd.flatpak.repo',
  gd: 'text/gdscript',
  gcode: 'text/g-code',
  gerber: 'application/vnd.gerber',
  go: 'text/go',
  gradle: 'text/gradle',
  groovy: 'text/groovy',
  h: 'text/c',
  hpp: 'text/c++',
  hs: 'text/haskell',
  htm: 'text/html',
  html: 'text/html',
  hxx: 'text/c++',
  iges: 'model/iges',
  igs: 'model/iges',
  ini: 'text/config',
  ino: 'text/arduino',
  ipynb: 'application/vnd.jupyter',
  java: 'text/java',
  jl: 'text/julia',
  js: 'text/javascript',
  json: 'application/json',
  json5: 'application/json5',
  jsonc: 'application/jsonc',
  jsx: 'text/jsx',
  kicad_mod: 'application/vnd.kicad.module',
  kicad_pcb: 'application/vnd.kicad.pcb',
  kicad_sch: 'application/vnd.kicad.schematic',
  kts: 'text/kotlin',
  kt: 'text/kotlin',
  lhs: 'text/haskell',
  list: 'text/plain',
  lock: 'text/plain',
  log: 'text/plain',
  lua: 'text/lua',
  m: 'text/objective-c',
  make: 'text/makefile',
  markdown: 'text/markdown',
  md: 'text/markdown',
  mjs: 'text/javascript',
  mm: 'text/objective-c++',
  net: 'text/spice',
  nim: 'text/nim',
  obj: 'model/obj',
  patch: 'text/patch',
  php: 'application/php',
  pl: 'text/perl',
  plist: 'application/xml',
  pm: 'text/perl',
  policy: 'text/selinux-policy',
  proto: 'text/protobuf',
  ps1: 'text/powershell',
  psm1: 'text/powershell',
  py: 'text/python',
  pyw: 'text/python',
  r: 'text/r',
  rb: 'text/ruby',
  rpm: 'application/x-rpm',
  rs: 'text/rust',
  scala: 'text/scala',
  scad: 'text/openscad',
  scm: 'text/scheme',
  sh: 'text/bash',
  service: 'text/systemd-unit',
  spice: 'text/spice',
  sql: 'application/sql',
  sqlite: 'application/vnd.sqlite3',
  sqlite3: 'application/vnd.sqlite3',
  step: 'model/step',
  stp: 'model/step',
  stl: 'model/stl',
  sv: 'text/systemverilog',
  svelte: 'text/svelte',
  swap: 'application/octet-stream',
  swift: 'text/swift',
  tcl: 'text/tcl',
  tex: 'text/tex',
  text: 'text/plain',
  tf: 'text/hcl',
  toml: 'application/toml',
  ts: 'text/typescript',
  tsx: 'text/tsx',
  txt: 'text/plain',
  v: 'text/verilog',
  vapi: 'text/vala',
  vala: 'text/vala',
  vhd: 'text/vhdl',
  vhdl: 'text/vhdl',
  vue: 'text/vue',
  xml: 'application/xml',
  xsession: 'text/bash',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  zig: 'text/zig',
  zsh: 'text/zsh',
};

const ESTIMATED_MIME_BY_BASENAME = {
  '.clang-format': 'text/yaml',
  '.dockerignore': 'text/plain',
  '.editorconfig': 'text/config',
  '.env': 'text/environment',
  '.env.example': 'text/environment',
  '.gtkrc-2.0': 'text/config',
  '.gitattributes': 'text/plain',
  '.gitignore': 'text/plain',
  '.gitmodules': 'text/config',
  '.inputrc': 'text/readline-config',
  '.profile': 'text/bash',
  '.prettierrc': 'application/json',
  '.xinitrc': 'text/bash',
  '.xprofile': 'text/bash',
  '.xresources': 'text/xresources',
  '.zprofile': 'text/zsh',
  'authorized_keys': 'text/ssh-authorized-keys',
  'bash.bashrc': 'text/bash',
  'bashrc': 'text/bash',
  'crontab': 'text/cron',
  'fstab': 'text/fstab',
  'group': 'text/passwd',
  'hosts': 'text/hosts',
  'hostname': 'text/plain',
  'interfaces': 'text/network-interfaces',
  'ld.so.conf': 'text/config',
  'locale.conf': 'text/config',
  'mime.types': 'text/mime-types',
  'modules': 'text/plain',
  'motd': 'text/plain',
  'nsswitch.conf': 'text/config',
  'os-release': 'text/os-release',
  'passwd': 'text/passwd',
  'profile': 'text/bash',
  'resolv.conf': 'text/resolv-conf',
  'shadow': 'text/passwd',
  'shells': 'text/plain',
  'sudoers': 'text/sudoers',
  'sysctl.conf': 'text/sysctl-conf',
  'tmpfiles.conf': 'text/tmpfiles-conf',
  'udev.conf': 'text/udev-rules',
  'cmakelists.txt': 'text/cmake',
  'dockerfile': 'text/dockerfile',
  'gemfile': 'text/ruby',
  'go.mod': 'text/go',
  'go.sum': 'text/plain',
  'justfile': 'text/makefile',
  'makefile': 'text/makefile',
  'package-lock.json': 'application/json',
  'package.json': 'application/json',
  'podfile': 'text/ruby',
  'procfile': 'text/plain',
  'rakefile': 'text/ruby',
  'requirements.txt': 'text/plain',
  'vagrantfile': 'text/ruby',
};

const FILE_TYPE_LABELS = {
  'application/json': 'JSON File',
  'application/json5': 'JSON5 File',
  'application/jsonc': 'JSONC File',
  'application/cpio': 'CPIO Archive',
  'application/octet-stream': 'Binary File',
  'application/php': 'PHP Source',
  'application/sql': 'SQL File',
  'application/toml': 'TOML File',
  'application/vnd.gerber': 'Gerber File',
  'application/vnd.jupyter': 'Jupyter Notebook',
  'application/vnd.kicad.module': 'KiCad Footprint',
  'application/vnd.kicad.pcb': 'KiCad PCB',
  'application/vnd.kicad.schematic': 'KiCad Schematic',
  'application/vnd.sqlite3': 'SQLite Database',
  'application/vnd.debian.binary-package': 'Debian Package',
  'application/vnd.flatpak': 'Flatpak Bundle',
  'application/vnd.flatpak.ref': 'Flatpak Ref',
  'application/vnd.flatpak.repo': 'Flatpak Repo',
  'application/x-desktop': 'Desktop Entry',
  'application/x-rpm': 'RPM Package',
  'application/yaml': 'YAML File',
  'image/vnd.dwg': 'DWG Drawing',
  'image/vnd.dxf': 'DXF Drawing',
  'text/arduino': 'Arduino Source',
  'text/apparmor-profile': 'AppArmor Profile',
  'text/apt-sources': 'APT Sources',
  'text/assembly': 'Assembly Source',
  'text/bash': 'Bash Script',
  'text/batch': 'Batch Script',
  'text/c': 'C Source',
  'text/c++': 'C++ Source',
  'text/clojure': 'Clojure Source',
  'text/cmake': 'CMake File',
  'text/config': 'Config File',
  'text/cron': 'Cron File',
  'text/csharp': 'C# Source',
  'text/dart': 'Dart Source',
  'text/dockerfile': 'Dockerfile',
  'text/elixir': 'Elixir Source',
  'text/environment': 'Environment File',
  'text/erlang': 'Erlang Source',
  'text/fish': 'Fish Script',
  'text/fortran': 'Fortran Source',
  'text/g-code': 'G-code File',
  'text/gdscript': 'GDScript Source',
  'text/go': 'Go Source',
  'text/gradle': 'Gradle File',
  'text/groovy': 'Groovy Source',
  'text/haskell': 'Haskell Source',
  'text/hcl': 'Terraform File',
  'text/hosts': 'Hosts File',
  'text/java': 'Java Source',
  'text/javascript': 'JavaScript',
  'text/jsx': 'JSX Source',
  'text/julia': 'Julia Source',
  'text/kotlin': 'Kotlin Source',
  'text/lua': 'Lua Source',
  'text/makefile': 'Makefile',
  'text/mime-types': 'MIME Types File',
  'text/network-interfaces': 'Network Interfaces',
  'text/nim': 'Nim Source',
  'text/objective-c': 'Objective-C Source',
  'text/objective-c++': 'Objective-C++ Source',
  'text/openscad': 'OpenSCAD File',
  'text/patch': 'Patch File',
  'text/perl': 'Perl Source',
  'text/passwd': 'Account Database',
  'text/powershell': 'PowerShell Script',
  'text/protobuf': 'Protocol Buffer',
  'text/python': 'Python Source',
  'text/r': 'R Source',
  'text/ruby': 'Ruby Source',
  'text/rust': 'Rust Source',
  'text/readline-config': 'Readline Config',
  'text/resolv-conf': 'Resolver Config',
  'text/scala': 'Scala Source',
  'text/scheme': 'Scheme Source',
  'text/selinux-policy': 'SELinux Policy',
  'text/ssh-authorized-keys': 'SSH Authorized Keys',
  'text/starlark': 'Starlark File',
  'text/spice': 'SPICE Netlist',
  'text/sudoers': 'Sudoers File',
  'text/svelte': 'Svelte Component',
  'text/swift': 'Swift Source',
  'text/sysctl-conf': 'Sysctl Config',
  'text/systemverilog': 'SystemVerilog Source',
  'text/systemd-unit': 'Systemd Unit',
  'text/tcl': 'Tcl Script',
  'text/tex': 'TeX File',
  'text/tmpfiles-conf': 'Tmpfiles Config',
  'text/tsx': 'TSX Source',
  'text/typescript': 'TypeScript',
  'text/udev-rules': 'Udev Rules',
  'text/vala': 'Vala Source',
  'text/verilog': 'Verilog Source',
  'text/vhdl': 'VHDL Source',
  'text/vue': 'Vue Component',
  'text/xresources': 'X Resources',
  'text/yaml': 'YAML File',
  'text/zig': 'Zig Source',
  'text/zsh': 'Zsh Script',
  'model/iges': 'IGES Model',
  'model/obj': 'OBJ Model',
  'model/step': 'STEP Model',
  'model/stl': 'STL Model',
};

function filenameExtension(filename = '') {
  const clean = String(filename).toLowerCase().split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1) : '';
}

function isGenericFileMime(mime = '') {
  const m = String(mime).toLowerCase();
  return !m || m === 'application/octet-stream';
}

function normalizeKnownFileMime(mime = '') {
  const m = String(mime).toLowerCase();
  if (['text/x-python', 'application/x-python-code'].includes(m)) return 'text/python';
  if (['application/x-sqlite3', 'application/x-sqlite', 'application/vnd.sqlite3'].includes(m)) return 'application/vnd.sqlite3';
  if (['text/x-shellscript', 'application/x-sh', 'application/x-shellscript'].includes(m)) return 'text/bash';
  if (['application/x-ipynb+json', 'application/x-jupyter-notebook'].includes(m)) return 'application/vnd.jupyter';
  if (m === 'application/x-yaml') return 'application/yaml';
  if (m === 'application/x-toml') return 'application/toml';
  if (m === 'text/x-c') return 'text/c';
  if (['text/x-c++src', 'text/x-c++hdr'].includes(m)) return 'text/c++';
  if (m === 'text/x-java-source') return 'text/java';
  if (m === 'text/x-go') return 'text/go';
  if (m === 'text/x-rustsrc') return 'text/rust';
  if (m === 'text/x-ruby') return 'text/ruby';
  if (m === 'text/x-php') return 'application/php';
  if (m === 'text/x-diff') return 'text/patch';
  return m;
}

function estimateMimeTypeFromName(filename = '') {
  const clean = String(filename).toLowerCase().split(/[?#]/)[0];
  const basename = clean.split(/[\\/]/).pop();
  if (ESTIMATED_MIME_BY_BASENAME[basename]) return ESTIMATED_MIME_BY_BASENAME[basename];
  if (/\.service$|\.socket$|\.timer$|\.mount$|\.automount$|\.target$|\.path$|\.slice$|\.scope$/.test(basename)) return 'text/systemd-unit';
  if (/\.rules$/.test(basename)) return 'text/udev-rules';
  if (/\.desktop$/.test(basename)) return 'application/x-desktop';
  if (/\.apparmor$|^apparmor\./.test(basename)) return 'text/apparmor-profile';
  if (/^(?:nginx|apache2?|httpd|sshd|ssh|journald|logind|resolved|timesyncd|systemd|pam|modprobe|modules-load|rsyslog|logrotate)\.conf$/.test(basename)) return 'text/config';
  if (/^(?:sources\.list|.*\.list)$/.test(basename) && /(?:^|[/\\])apt(?:[/\\]|$)/.test(clean)) return 'text/apt-sources';
  if (/(?:^|[/\\])(?:sysctl\.d|tmpfiles\.d|modules-load\.d|modprobe\.d|sudoers\.d|logrotate\.d|pam\.d|udev[/\\]rules\.d)(?:[/\\]|$)/.test(clean)) return 'text/config';
  const ext = filenameExtension(filename);
  return ESTIMATED_MIME_BY_EXTENSION[ext] || '';
}

function isLikelyText(bytes) {
  if (!bytes?.length) return false;
  const sampleLength = Math.min(bytes.length, 4096);
  let printable = 0;
  for (let i = 0; i < sampleLength; i++) {
    const byte = bytes[i];
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128) printable++;
  }
  return printable / sampleLength > 0.92;
}

async function estimateFileMimeType(file) {
  const byName = estimateMimeTypeFromName(file.name);
  if (byName) return byName;

  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const sqliteMagic = 'SQLite format 3';
  if (head.length >= sqliteMagic.length) {
    const magic = String.fromCharCode(...head.slice(0, sqliteMagic.length));
    if (magic === sqliteMagic) return 'application/vnd.sqlite3';
  }

  if (!isLikelyText(head)) return '';
  const textHead = new TextDecoder('utf-8', { fatal: false }).decode(head);
  const firstLine = textHead.split(/\r?\n/, 1)[0].toLowerCase();
  if (firstLine.startsWith('#!')) {
    if (/\bpython(?:\d(?:\.\d+)?)?\b/.test(firstLine)) return 'text/python';
    if (/\bnode\b/.test(firstLine)) return 'text/javascript';
    if (/\bruby\b/.test(firstLine)) return 'text/ruby';
    if (/\bperl\b/.test(firstLine)) return 'text/perl';
    if (/\bphp\b/.test(firstLine)) return 'application/php';
    if (/\bpwsh|powershell\b/.test(firstLine)) return 'text/powershell';
    if (/\b(?:ba|z|k)?sh\b/.test(firstLine)) return 'text/bash';
  }

  try {
    const parsed = JSON.parse(textHead);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cells) && parsed.nbformat) {
      return 'application/vnd.jupyter';
    }
    return 'application/json';
  } catch {}

  if (/^\s*(?:---\s*[\r\n]|[\w.-]+\s*:)/.test(textHead)) return 'application/yaml';
  if (/^\s*<\?xml\b/.test(textHead) || /^\s*<[\w:-]+[\s>]/.test(textHead)) return 'application/xml';
  if (/^\s*(?:select|insert|update|delete|create|alter|drop)\b/i.test(textHead)) return 'application/sql';
  if (/^\s*diff --git\b/m.test(textHead) || /^\s*@@\s+-\d+/m.test(textHead)) return 'text/patch';
  if (/^\s*\[(?:unit|service|install|socket|timer|mount|automount|path|slice|target)\]\s*$/im.test(textHead)) return 'text/systemd-unit';
  if (/^\s*\[desktop entry\]\s*$/im.test(textHead)) return 'application/x-desktop';
  if (/^\s*(?:deb|deb-src)\s+\S+\s+\S+/m.test(textHead)) return 'text/apt-sources';
  if (/^\s*(?:[A-Za-z0-9_*?-]+(?:==?|!=|:=|\+=|-=)|SUBSYSTEM(?:==|!=)|ACTION(?:==|!=)|KERNEL(?:==|!=))/m.test(textHead)) return 'text/udev-rules';
  if (/^\s*[\w.-]+\s*=\s*[-\w./: ]+\s*$/m.test(textHead)) return 'text/sysctl-conf';
  if (/^\s*(?:@(?:reboot|yearly|annually|monthly|weekly|daily|hourly)|(?:\S+\s+){5}\S+)/m.test(textHead)) return 'text/cron';
  if (/^\s*(?:root|%[\w-]+|\w+)\s+(?:ALL|\S+)=/.test(textHead)) return 'text/sudoers';
  if (/^\s*(?:\S+\s+){5}\S+\s+\d+\s+\d+\s*$/m.test(textHead)) return 'text/fstab';
  if (/^\s*(?:\d{1,3}\.){3}\d{1,3}\s+\S+/m.test(textHead) || /^\s*[a-f0-9:]{2,}\s+\S+/im.test(textHead)) return 'text/hosts';
  if (/^\s*[^:\n]+:[^:\n]*:\d+:\d+:[^:\n]*:[^:\n]*:[^:\n]*\s*$/m.test(textHead)) return 'text/passwd';

  return 'text/plain';
}

const TOKEN_MAX_LENGTH = 40;
const PASSKEY_LENGTH = 64;
const PASSKEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PAIRING_PIN_LENGTH = 8;
const PAIRING_PIN_TTL_MS = 60000;
const PAIRING_JOIN_TIMEOUT_MS = 8000;
const PAIRING_MAX_UNUSED_PINS = 5;
const TOKEN_ADJECTIVES = [
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
const TOKEN_NOUNS = [
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
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, TOKEN_MAX_LENGTH);
}

function generateToken() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const adjective = TOKEN_ADJECTIVES[bytes[0] % TOKEN_ADJECTIVES.length];
  const noun = TOKEN_NOUNS[bytes[1] % TOKEN_NOUNS.length];
  return `${adjective}-${noun}`;
}

function generatePassphrase() {
  const chars = [];
  const maxUnbiasedByte = Math.floor(256 / PASSKEY_ALPHABET.length) * PASSKEY_ALPHABET.length;
  while (chars.length < PASSKEY_LENGTH) {
    const bytes = new Uint8Array(PASSKEY_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= maxUnbiasedByte) continue;
      chars.push(PASSKEY_ALPHABET[byte % PASSKEY_ALPHABET.length]);
      if (chars.length === PASSKEY_LENGTH) break;
    }
  }
  return chars.join('');
}

function generatePairingPin() {
  const digits = [];
  const maxUnbiasedByte = Math.floor(256 / 10) * 10;
  while (digits.length < PAIRING_PIN_LENGTH) {
    const bytes = new Uint8Array(PAIRING_PIN_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= maxUnbiasedByte) continue;
      digits.push(String(byte % 10));
      if (digits.length === PAIRING_PIN_LENGTH) break;
    }
  }
  return digits.join('');
}

function formatPairingPinInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, PAIRING_PIN_LENGTH);
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

function isGeneratedPasskey(value) {
  return typeof value === 'string'
    && value.length === PASSKEY_LENGTH
    && /^[A-Za-z0-9]+$/.test(value);
}

function storedOrNewPasskey() {
  const saved = localStorage.getItem('clipshare_passphrase') || '';
  return isGeneratedPasskey(saved) ? saved : generatePassphrase();
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
  if (FILE_TYPE_LABELS[mime]) return FILE_TYPE_LABELS[mime];
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
  if (m === 'application/vnd.sqlite3')
    return '<span class="mdi mdi-database file-type-icon" style="color:#6d4c41"></span>';
  if (FILE_TYPE_LABELS[m] || m.startsWith('model/'))
    return '<span class="mdi mdi-file-code file-type-icon" style="color:#455a64"></span>';
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

function isBrowserPlayableVideo(mime) {
  const m = (mime || '').toLowerCase();
  if (!m.startsWith('video/')) return false;
  const video = document.createElement('video');
  return !!video.canPlayType(m);
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

async function prepareImageThumbnail(item, blob, { force = false } = {}) {
  if (item?.type !== 'image' || (!force && isBrowserViewableImage(item.mimeType))) return;
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
  for (const [peerId, peer] of connectedPeers) {
    const id = imap.get(peerId);
    const compatibility = peerCompatibilityLabel(peer);
    const rtcState = webRtcPeerState(peerId);
    const classes = [
      'peer-pill',
      peer.compatibility === 'incompatible' ? 'peer-pill-incompatible' : '',
      rtcState === 'connected' ? 'peer-pill-webrtc-connected' : '',
      rtcState === 'connecting' ? 'peer-pill-webrtc-connecting' : '',
      rtcState === 'failed' ? 'peer-pill-webrtc-failed' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${escAttr(classes)}" style="background:${id.bg}" title="${escHtml([id.fullName, compatibility, webRtcStateLabel(peerId)].filter(Boolean).join(' - '))}"><i data-lucide="${id.animalIcon}" style="color:${id.iconColor}"></i></div>`;
  }
  container.innerHTML = html;
  container.title = `${clientCount} connected user${clientCount === 1 ? '' : 's'}`;
  refreshIcons();
  if (chatPanelOpen) renderChatMessages();
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

function redactedIceConfig(config) {
  return {
    iceServers: (config?.iceServers || []).map(server => ({
      urls: server.urls || [],
      username: server.username ? String(server.username) : '',
      credentialPresent: !!server.credential,
    })),
  };
}

function itemDiagnosticMeta(item) {
  if (!item) return null;
  return {
    id: item.id,
    type: item.type,
    filename: item.filename || '',
    mimeType: item.mimeType || '',
    size: item.size || 0,
    addedAt: item.addedAt || 0,
    encrypted: !!item.encrypted,
    hasRawBuffer: !!item.rawBuffer,
    hasDataUrl: !!item.dataUrl,
    hasThumbnail: !!item.thumbnailDataUrl,
    receivedEncryptedChunks: item.receivedEncryptedChunks || 0,
    totalEncryptedChunks: item.totalEncryptedChunks || 0,
  };
}

function mapObject(map, valueMapper = value => value) {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, valueMapper(value, key)]));
}

function setArray(set) {
  return [...(set || [])];
}

function webRtcDiagnosticRecord(record) {
  if (!record) return null;
  return {
    state: record.state || '',
    error: record.error || '',
    startBlockedReason: record.startBlockedReason || '',
    startAttempts: record.startAttempts || 0,
    lastStartAttemptAt: record.lastStartAttemptAt || null,
    initiator: !!record.initiator,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    connectionState: record.connectionState || record.pc?.connectionState || '',
    iceConnectionState: record.iceConnectionState || record.pc?.iceConnectionState || '',
    iceGatheringState: record.iceGatheringState || record.pc?.iceGatheringState || '',
    signalingState: record.signalingState || record.pc?.signalingState || '',
    channelState: record.channelState || record.channel?.readyState || '',
    pendingCandidates: record.pendingCandidates?.length || 0,
    iceCandidatesSent: record.iceCandidatesSent || 0,
    iceCandidatesReceived: record.iceCandidatesReceived || 0,
    localDescriptionType: record.localDescriptionType || '',
    remoteDescriptionType: record.remoteDescriptionType || '',
    lastSignalSentAt: record.lastSignalSentAt || null,
    lastSignalSentType: record.lastSignalSentType || '',
    lastSignalReceivedAt: record.lastSignalReceivedAt || null,
    lastSignalReceivedType: record.lastSignalReceivedType || '',
  };
}

function transferDiagnosticRecord(transfer) {
  return {
    received: transfer.received || 0,
    totalChunks: transfer.totalChunks || 0,
    senderId: transfer.senderId || '',
    currentChunk: transfer.currentChunk || 0,
    startTime: transfer.startTime || null,
    chunkSources: [...(transfer.chunkSources || [])],
  };
}

function outboundDiagnosticRecord(progress) {
  return {
    sent: progress.sent || 0,
    total: progress.total || 0,
    currentChunk: progress.currentChunk || 0,
    startTime: progress.startTime || null,
    initialDone: !!progress.initialDone,
    retryAttempts: progress.retryAttempts || 0,
    ackedChunks: setArray(progress.ackedChunks),
  };
}

async function buildDiagnosticSnapshot() {
  const config = await loadWebRtcConfig();
  await startWebRtcForCompatiblePeers();
  await sleep(150);
  const imap = buildPeerIdentityMap();
  return {
    kind: 'clipshare-diagnostic-v1',
    exportedAt: new Date().toISOString(),
    app: {
      clientDiagnosticBuild: CLIENT_DIAGNOSTIC_BUILD,
      token,
      clientId,
      peerName: imap.get(clientId)?.fullName || '',
      clientCount,
      encryptionEnabled,
      hasEncryptionKey: !!encryptionKey,
      wsState: wsStateLabel(ws),
      dataWsState: wsStateLabel(dataWs),
      webRtcSupported: isWebRtcSupported(),
      webRtcConfig: redactedIceConfig(config),
      selfPeerInfo,
      selfClientMetrics,
      pairingActive: pairingIsActive(),
      pairingHosts: [...pairingHosts.values()],
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      online: navigator.onLine,
      visibilityState: document.visibilityState,
      locationProtocol: location.protocol,
      locationHost: location.host,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
    },
    peers: [...connectedPeers.entries()].map(([peerId, peer]) => ({
      clientId: peerId,
      name: imap.get(peerId)?.fullName || '',
      label: peer.label || '',
      ip: peer.ip || '',
      compatibility: peer.compatibility || '',
      compatibilityDetail: peerCompatibilityDetail(peer),
      metrics: peer.metrics || {},
      webRtcStatus: webRtcStateLabel(peerId),
      webRtcStartEligible: !webRtcStartBlockReason(peerId),
      webRtcStartBlockReason: webRtcStartBlockReason(peerId),
      webRtcUnavailableReason: webRtcPeerState(peerId) === 'unavailable' ? webRtcUnavailableReason(peerId) : '',
      webRtc: webRtcDiagnosticRecord(webRtcPeers.get(peerId)),
      cards: [...(peerCardMetadata.get(peerId) || new Map()).values()].map(itemDiagnosticMeta),
    })),
    items: [...items.values()].map(itemDiagnosticMeta),
    roomManifest: [...roomManifest.values()].map(record => ({
      ownerId: record.ownerId || '',
      holders: record.holders || [],
      revision: record.revision || 0,
      meta: itemDiagnosticMeta(record.meta),
    })),
    manifestRevisions: mapObject(manifestRevisions),
    transfers: {
      incoming: mapObject(binaryTransfers, transferDiagnosticRecord),
      outbound: mapObject(outboundTransfers, peerMap => mapObject(peerMap, outboundDiagnosticRecord)),
      remoteStatuses: [...remoteTransferStatuses.values()],
      pendingDownloadSourceIds: mapObject(pendingDownloadSourceIds),
      pendingDownloadTriedSources: mapObject(pendingDownloadTriedSources, setArray),
      pendingChunkRequestBatches: mapObject(pendingChunkRequestBatches, batch => ({
        sourceClientId: batch.sourceClientId,
        chunks: setArray(batch.chunks),
      })),
    },
    chat: {
      messageCount: chatMessages.length,
      unreadChatCount,
      panelOpen: chatPanelOpen,
      replyTargetId: chatReplyTargetId,
    },
  };
}

async function exportDiagnostics() {
  try {
    const snapshot = await buildDiagnosticSnapshot();
    const text = JSON.stringify(snapshot, null, 2);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch { }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipshare-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(copied ? 'Diagnostics copied and downloaded' : 'Diagnostics downloaded');
  } catch (err) {
    console.error('diagnostic-export-failed', err);
    showToast('Could not export diagnostics');
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
const chatMessages = [];
let chatPanelOpen = false;
let unreadChatCount = 0;
let chatReplyTargetId = null;
const binaryTransfers = new Map(); // itemId -> {chunks,received,totalChunks}
const editTimers = new Map();
const BINARY_CHUNK_SIZE = 65536; // bytes per chunk
const CHUNK_REQUEST_TARGET_BYTES = 1024 * 1024;
const CHUNK_REQUEST_MAX_CHUNKS = Math.max(1, Math.floor(CHUNK_REQUEST_TARGET_BYTES / BINARY_CHUNK_SIZE));
const CHUNK_RETRY_DELAY_MS = 1200;
const CHUNK_RETRY_MAX_ATTEMPTS = 3;
const MAX_TRANSFER_CHUNKS = Math.ceil((128 * 1024 * 1024) / BINARY_CHUNK_SIZE) + 1;
const DOWNLOAD_SOURCE_RETRY_DELAY_MS = 2000;
const METRICS_PING_INTERVAL_MS = 10000;
const KEY_PROOF_TIMEOUT_MS = 3500;
const WEBRTC_ICE_CONFIG_FALLBACK = { iceServers: [] };
const WEBRTC_HEARTBEAT_INTERVAL_MS = 15000;
let clientCount = 0;
let draggingInternal = false;
let tokenQr = null;
let startQr = null;
let encryptedMessageSeq = 0;
let lastForegroundCheckAt = 0;
let startPairingCreated = false;
let modalPairingActive = false;
let pairingPin = '';
let pairingPinId = '';
let pairingPinExpiresAt = 0;
let pairingUnusedPinCount = 0;
let pairingCurrentPinUsed = false;
let pairingRotateTimer = null;
let pairingUiTimer = null;
let pairingHostWs = null;
let pairingJoinWs = null;
let pairingJoinPakeSecret = null;
let pairingJoinPakeStart = null;
let pairingJoinRequestId = null;
let pairingJoinTimer = null;
let pairingJoinToken = '';
const pairingHostPendingRequests = new Map();
const pairingHosts = new Map();
let metricsPingTimer = null;
let peersModalRefreshTimer = null;
let openPeerDetailId = null;
let pendingInitialSyncSources = null;
const selfClientMetrics = {
  deviceType: detectDeviceType(),
  pingMs: null,
  uploadBps: null,
  downloadBps: null,
  updatedAt: Date.now(),
};

const CHAT_EMOTES = [
  { token: 'smile', icon: 'smile', color: '#fbbc04' },
  { token: 'sad', icon: 'frown', color: '#fbbc04' },
  { token: 'annoyed', icon: 'annoyed', color: '#fbbc04' },
  { token: 'laughing', icon: 'laugh', color: '#fbbc04' },
  { token: 'heart', icon: 'heart', color: '#d93025' },
  { token: 'thumbs-up', icon: 'thumbs-up', color: '#1a73e8' },
  { token: 'thumbs-down', icon: 'thumbs-down', color: '#d93025' },
  { token: 'party-popper', icon: 'party-popper', color: '#9c27b0' },
  { token: 'coffee', icon: 'coffee', color: '#795548' },
  { token: 'zap', icon: 'zap', color: '#fbbc04' },
  { token: 'flame', icon: 'flame', color: '#e8710a' },
  { token: 'star', icon: 'star', color: '#fbbc04' },
  { token: 'check', icon: 'check', color: '#188038' },
  { token: 'fail', icon: 'x', color: '#d93025' },
];

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

function identityForPeerNumber(peerNumber) {
  const slot = Math.max(0, (Number(peerNumber) || 1) - 1);
  const color = PEER_COLORS[slot % PEER_COLORS.length];
  const animal = PEER_ANIMALS[slot % PEER_ANIMALS.length];
  return { bg: color.bg, iconColor: color.icon, animalIcon: animal.icon, fullName: `${color.name} ${animal.name}` };
}

function peerDisplayName(peerId, peerNumber = null) {
  const current = buildPeerIdentityMap().get(peerId);
  if (current?.fullName) return current.fullName;
  if (peerNumber) return identityForPeerNumber(peerNumber).fullName;
  return fallbackPeerIdentity(peerId).fullName;
}

function peerPillHtml(identity, extraClass = '', title = '') {
  const hint = title || identity.fullName || '';
  return `<div class="peer-pill${extraClass ? ' ' + extraClass : ''}" style="background:${identity.bg}"${hint ? ` title="${escAttr(hint)}"` : ''}><i data-lucide="${identity.animalIcon}" style="color:${identity.iconColor}"></i></div>`;
}

function peerCompatibilityLabel(peer) {
  if (!peer || peer.compatibility === 'compatible') return '';
  if (peer.compatibility === 'incompatible') return 'Incompatible key';
  return 'Checking key';
}

function peerCompatibilityDetail(peer, isSelf = false) {
  if (isSelf) return 'This device';
  if (!peer) return 'Unknown';
  if (peer.compatibility === 'compatible') return 'Compatible key';
  if (peer.compatibility === 'incompatible') return 'Incompatible key';
  return 'Checking key';
}

function peerIconStackHtml(peerIds = [], extraClass = '') {
  const imap = buildPeerIdentityMap();
  const ids = [...new Set((peerIds || []).filter(Boolean).map(String))];
  if (!ids.length) {
    const fallback = fallbackPeerIdentity('');
    return `<div class="transfer-peer-icons${extraClass ? ' ' + extraClass : ''}">${peerPillHtml(fallback, 'peer-pill-sm', fallback.fullName)}</div>`;
  }
  return `<div class="transfer-peer-icons${extraClass ? ' ' + extraClass : ''}">${ids.map(peerId => (
    (() => {
      const identity = imap.get(peerId) || fallbackPeerIdentity(peerId);
      return peerPillHtml(identity, 'peer-pill-sm', identity.fullName);
    })()
  )).join('')}</div>`;
}

function fallbackPeerIdentity(peerId) {
  return {
    bg: 'var(--bg)',
    iconColor: 'var(--text-secondary)',
    animalIcon: 'user',
    fullName: peerId ? `Guest ${String(peerId).slice(0, 6)}` : 'Unknown',
  };
}

function transferSourceIdsFromChunks(chunkSources = [], fallbackSourceId = null) {
  const ids = [...new Set((chunkSources || []).filter(Boolean).map(String))];
  if (!ids.length && fallbackSourceId) ids.push(String(fallbackSourceId));
  return ids;
}

function chatAuthorIdentity(message) {
  const current = buildPeerIdentityMap().get(message.authorId);
  if (current) return current;
  if (message.authorIdentity) return message.authorIdentity;
  return fallbackPeerIdentity(message.authorId);
}

function chatMessageFromSelf(text) {
  const identity = buildPeerIdentityMap().get(clientId) || fallbackPeerIdentity(clientId);
  const replyTo = chatReplyTargetId ? chatReplyPayload(chatReplyTargetId) : null;
  return {
    id: randomUUID(),
    authorId: clientId,
    authorIdentity: identity,
    text: String(text || '').slice(0, 2000),
    replyTo,
    reactions: {},
    addedAt: Date.now(),
  };
}

function chatMessageFromCard(item) {
  const identity = buildPeerIdentityMap().get(clientId) || fallbackPeerIdentity(clientId);
  return {
    id: randomUUID(),
    authorId: clientId,
    authorIdentity: identity,
    text: '',
    replyTo: null,
    card: chatCardPayload(item),
    reactions: {},
    addedAt: Date.now(),
  };
}

function normalizeChatMessage(message) {
  const card = normalizeChatCard(message?.card);
  if (!message?.id || (!message.text && !card)) return null;
  return {
    id: String(message.id),
    authorId: String(message.authorId || ''),
    authorIdentity: message.authorIdentity || null,
    text: String(message.text).slice(0, 2000),
    replyTo: normalizeChatReply(message.replyTo),
    card,
    reactions: normalizeChatReactions(message.reactions),
    addedAt: Number(message.addedAt) || Date.now(),
  };
}

function normalizeChatReply(replyTo) {
  if (!replyTo?.id) return null;
  const card = normalizeChatCard(replyTo.card);
  return {
    id: String(replyTo.id),
    authorName: String(replyTo.authorName || 'Unknown').slice(0, 80),
    text: String(replyTo.text || '').slice(0, 240),
    card,
  };
}

function chatCardPayload(item) {
  if (!item?.id) return null;
  const thumbnailDataUrl = item.type === 'image' && isSafeChatImagePreview(item.thumbnailDataUrl) ? item.thumbnailDataUrl : '';
  return {
    id: String(item.id),
    type: String(item.type || 'file').slice(0, 24),
    filename: String(item.filename || item.content || 'Card').slice(0, 160),
    mimeType: String(item.mimeType || '').slice(0, 120),
    size: Number(item.size) || 0,
    ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
  };
}

function normalizeChatCard(card) {
  if (!card?.id) return null;
  const thumbnailDataUrl = isSafeChatImagePreview(card.thumbnailDataUrl) ? card.thumbnailDataUrl : '';
  return {
    id: String(card.id),
    type: String(card.type || 'file').slice(0, 24),
    filename: String(card.filename || 'Card').slice(0, 160),
    mimeType: String(card.mimeType || '').slice(0, 120),
    size: Number(card.size) || 0,
    ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
  };
}

function isSafeChatImagePreview(value) {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= 450000;
}

function normalizeChatReactions(reactions = {}) {
  const normalized = {};
  for (const [token, reactors] of Object.entries(reactions || {})) {
    if (!chatEmoteByToken(token) || !Array.isArray(reactors)) continue;
    const ids = [...new Set(reactors.map(String).filter(Boolean))];
    if (ids.length) normalized[token] = ids;
  }
  return normalized;
}

function chatMessageById(messageId) {
  return chatMessages.find(message => message.id === messageId) || null;
}

function chatEmoteByToken(token) {
  return CHAT_EMOTES.find(emote => emote.token === token) || null;
}

function chatReplyPayload(messageId) {
  const message = chatMessageById(messageId);
  if (!message) return null;
  const identity = chatAuthorIdentity(message);
  return {
    id: message.id,
    authorName: identity.fullName,
    text: message.text,
    card: message.card || null,
  };
}

function appendChatMessage(message, { broadcast = false } = {}) {
  const normalized = normalizeChatMessage(message);
  if (!normalized || chatMessages.some(m => m.id === normalized.id)) return;
  chatMessages.push(normalized);
  chatMessages.sort((a, b) => a.addedAt - b.addedAt);
  if (chatMessages.length > 500) chatMessages.splice(0, chatMessages.length - 500);
  if (!chatPanelOpen && normalized.authorId !== clientId) {
    unreadChatCount++;
    updateChatUnreadBadge();
  }
  saveChatMessages();
  renderChatMessages();
  if (broadcast) {
    wsSend({ type: 'relay', payload: { type: 'chat_line', message: normalized } });
  }
}

function updateChatUnreadBadge() {
  const badge = document.getElementById('chat-unread');
  if (!badge) return;
  badge.textContent = unreadChatCount > 99 ? '99+' : String(unreadChatCount);
  badge.classList.toggle('visible', unreadChatCount > 0);
}

function chatStorageKey() {
  return token ? `clipshare_chat_${token}` : '';
}

function saveChatMessages() {
  const key = chatStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(chatMessages));
  } catch { }
}

function loadChatMessages() {
  const key = chatStorageKey();
  if (!key) return;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    chatMessages.length = 0;
    (Array.isArray(stored) ? stored : []).forEach(message => {
      const normalized = normalizeChatMessage(message);
      if (normalized && !chatMessages.some(m => m.id === normalized.id)) chatMessages.push(normalized);
    });
    chatMessages.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    chatMessages.length = 0;
  }
  renderChatMessages();
}

function renderChatText(text) {
  const emoteMap = new Map(CHAT_EMOTES.map(e => [e.token, e]));
  const source = String(text || '');
  const parts = [];
  let lastIndex = 0;
  source.replace(/:([a-z0-9-]+):/g, (match, token, index) => {
    parts.push(escHtml(source.slice(lastIndex, index)));
    const emote = emoteMap.get(token);
    parts.push(emote ? `<i data-lucide="${emote.icon}" title="${escAttr(match)}" style="color:${escAttr(emote.color)}"></i>` : escHtml(match));
    lastIndex = index + match.length;
    return match;
  });
  parts.push(escHtml(source.slice(lastIndex)));
  return parts.join('');
}

function renderReactionIcon(token) {
  const emote = chatEmoteByToken(token);
  if (!emote) return '';
  return `<i data-lucide="${emote.icon}" style="color:${escAttr(emote.color)}"></i>`;
}

function renderChatReplyPreview(replyTo) {
  if (!replyTo) return '';
  return `<div class="chat-reply-preview"><span>${escHtml(replyTo.authorName)}</span>${renderChatCardMention(replyTo.card, 'chat-card-mention-compact')}<div>${renderChatText(replyTo.text || (replyTo.card ? replyTo.card.filename : ''))}</div></div>`;
}

function chatCardDownloadState(cardId) {
  if (!cardId) return null;
  const id = String(cardId);
  const item = items.get(id);
  const transfer = binaryTransfers.get(id);
  if (transfer?.totalChunks) {
    const percent = Math.max(0, Math.min(100, Math.round((transfer.received || 0) / transfer.totalChunks * 100)));
    return { pending: true, percent };
  }
  if (expectsIncomingChunks(item) || transfer) return { pending: true, percent: 0 };
  return { pending: false, percent: 100 };
}

function updateChatCardDownloadState(cardId) {
  const state = chatCardDownloadState(cardId);
  document.querySelectorAll('.chat-card-mention[data-card-id]').forEach(button => {
    if (button.dataset.cardId !== String(cardId)) return;
    const pending = !!state?.pending;
    const percent = pending ? state.percent : 100;
    button.classList.toggle('chat-card-pending', pending);
    button.style.setProperty('--chat-card-progress', `${percent}%`);
    button.setAttribute('aria-busy', pending ? 'true' : 'false');
    const status = button.querySelector('.chat-card-progress-label');
    if (status) status.textContent = pending ? `${percent}%` : '';
  });
}

function renderChatCardMention(card, extraClass = '') {
  if (!card) return '';
  const typeLabel = card.type === 'image' ? 'Image' : fileTypeName(card.mimeType);
  const sizeLabel = card.size ? humanSize(card.size) : 'Card';
  const hasPreview = card.type === 'image' && isSafeChatImagePreview(card.thumbnailDataUrl);
  const downloadState = chatCardDownloadState(card.id);
  const isPending = !!downloadState?.pending;
  const className = `chat-card-mention${hasPreview ? ' chat-card-image' : ''}${isPending ? ' chat-card-pending' : ''}${extraClass ? ' ' + extraClass : ''}`;
  const visual = hasPreview
    ? `<img class="chat-card-preview" src="${escAttr(card.thumbnailDataUrl)}" alt="${escAttr(card.filename)}">`
    : fileTypeIcon(card.mimeType);
  const progress = isPending ? downloadState.percent : 100;
  return `<button class="${escAttr(className)}" data-action="show-card" data-card-id="${escAttr(card.id)}" title="Show card" aria-busy="${isPending ? 'true' : 'false'}" style="--chat-card-progress:${progress}%">${visual}<span><strong>${escHtml(card.filename)}</strong><small>${escHtml(typeLabel)} · ${escHtml(sizeLabel)}</small></span><span class="chat-card-progress-track" aria-hidden="true"><span></span></span><span class="chat-card-progress-label">${isPending ? `${progress}%` : ''}</span></button>`;
}

function renderChatReactions(message) {
  const reactions = normalizeChatReactions(message.reactions);
  const chips = Object.entries(reactions).map(([token, reactors]) => {
    const mine = reactors.includes(clientId);
    return `<button class="chat-reaction-chip${mine ? ' mine' : ''}" data-action="react" data-message-id="${escAttr(message.id)}" data-token="${escAttr(token)}" title=":${escAttr(token)}:">
  ${renderReactionIcon(token)}<span>${reactors.length}</span>
</button>`;
  }).join('');
  return chips ? `<div class="chat-reactions">${chips}</div>` : '';
}

function renderChatMessageActions(message) {
  const reactionOptions = CHAT_EMOTES.map(({ token }) =>
    `<button class="chat-reaction-option" data-action="react" data-message-id="${escAttr(message.id)}" data-token="${escAttr(token)}" title="React :${escAttr(token)}:" aria-label="React :${escAttr(token)}:">
  ${renderReactionIcon(token)}
</button>`
  ).join('');
  return `<div class="chat-message-actions">
  <div class="chat-reaction-dropdown">
    <button class="btn-icon chat-message-action" type="button" data-action="toggle-reactions" title="React" aria-label="React" aria-haspopup="true"><i data-lucide="smile"></i></button>
    <div class="chat-reaction-menu" role="menu">
      ${reactionOptions}
    </div>
  </div>
  <button class="btn-icon chat-message-action" data-action="reply" data-message-id="${escAttr(message.id)}" title="Reply"><i data-lucide="reply"></i></button>
</div>`;
}

function isEmoteOnlyChat(text) {
  const emoteTokens = new Set(CHAT_EMOTES.map(e => e.token));
  const source = String(text || '');
  let stripped = source.replace(/:([a-z0-9-]+):/g, (match, token) => emoteTokens.has(token) ? '' : match);
  try {
    stripped = stripped.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
    return !stripped.trim() && /(?::[a-z0-9-]+:|[\p{Extended_Pictographic}])/u.test(source);
  } catch {
    return !stripped.trim() && /:([a-z0-9-]+):/.test(source);
  }
}

function scrollChatToLatest() {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  list.scrollTop = list.scrollHeight;
  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
  });
}

function renderChatMessages() {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  if (!chatMessages.length) {
    list.innerHTML = '<div class="chat-empty">No messages yet</div>';
    refreshIcons();
    return;
  }
  list.innerHTML = chatMessages.map(message => {
    const identity = chatAuthorIdentity(message);
    const isSelf = message.authorId === clientId;
    const emoteOnly = isEmoteOnlyChat(message.text);
    return `<div class="chat-line${isSelf ? ' chat-line-self' : ''}" style="--chat-user-bg:${escAttr(identity.bg)};--chat-user-accent:${escAttr(identity.iconColor)}">
  ${peerPillHtml(identity, 'peer-pill-sm')}
  <div class="chat-bubble-wrap">
    <div class="chat-meta"><span>${escHtml(identity.fullName)}${isSelf ? ' (You)' : ''}</span><span>${timeAgo(message.addedAt)}</span></div>
    <div class="chat-bubble${emoteOnly ? ' chat-bubble-emote-only' : ''}">${renderChatReplyPreview(message.replyTo)}${renderChatCardMention(message.card)}${renderChatText(message.text)}</div>
    ${renderChatReactions(message)}
    ${renderChatMessageActions(message)}
  </div>
</div>`;
  }).join('');
  refreshIcons();
  scrollChatToLatest();
}

function renderChatEmotes() {
  const wrap = document.getElementById('chat-emotes');
  if (!wrap) return;
  wrap.innerHTML = CHAT_EMOTES.map(e =>
    `<button class="btn-icon chat-emote" data-token="${escAttr(e.token)}" title=":${escAttr(e.token)}:"><i data-lucide="${e.icon}" style="color:${escAttr(e.color)}"></i></button>`
  ).join('');
  wrap.querySelectorAll('.chat-emote').forEach(btn => {
    btn.addEventListener('click', () => insertChatEmote(btn.dataset.token));
  });
  refreshIcons();
}

function renderChatReplyTarget() {
  const wrap = document.getElementById('chat-reply-target');
  if (!wrap) return;
  const replyTo = chatReplyTargetId ? chatReplyPayload(chatReplyTargetId) : null;
  if (!replyTo) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML = `<div class="chat-reply-target-card">
  <div><span>${escHtml(replyTo.authorName)}</span><div>${renderChatText(replyTo.text || (replyTo.card ? replyTo.card.filename : ''))}</div></div>
  <button class="btn-icon" id="chat-reply-cancel" title="Cancel reply"><i data-lucide="x"></i></button>
</div>`;
  document.getElementById('chat-reply-cancel')?.addEventListener('click', clearChatReplyTarget);
  refreshIcons();
}

function setChatReplyTarget(messageId) {
  if (!chatMessageById(messageId)) return;
  chatReplyTargetId = messageId;
  renderChatReplyTarget();
  toggleChatPanel(true);
}

function clearChatReplyTarget() {
  chatReplyTargetId = null;
  renderChatReplyTarget();
}

function toggleChatReaction(messageId, token, { broadcast = true, reactorId = clientId } = {}) {
  const message = chatMessageById(messageId);
  if (!message || !chatEmoteByToken(token)) return;
  const id = String(reactorId || clientId);
  message.reactions = normalizeChatReactions(message.reactions);
  const reactors = new Set(message.reactions[token] || []);
  if (reactors.has(id)) reactors.delete(id);
  else reactors.add(id);
  if (reactors.size) message.reactions[token] = [...reactors];
  else delete message.reactions[token];
  saveChatMessages();
  renderChatMessages();
  if (broadcast) {
    wsSend({ type: 'relay', payload: { type: 'chat_reaction', messageId, token, reactorId: id } });
  }
}

function handleChatMessageClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'toggle-reactions') {
    const dropdown = button.closest('.chat-reaction-dropdown');
    document.querySelectorAll('.chat-reaction-dropdown.open').forEach(el => {
      if (el !== dropdown) el.classList.remove('open');
    });
    dropdown?.classList.toggle('open');
    return;
  }
  const messageId = button.dataset.messageId;
  if (button.dataset.action === 'react') {
    button.closest('.chat-reaction-dropdown')?.classList.remove('open');
    toggleChatReaction(messageId, button.dataset.token);
  } else if (button.dataset.action === 'reply') {
    setChatReplyTarget(messageId);
  } else if (button.dataset.action === 'show-card') {
    focusCard(button.dataset.cardId, { closeChatOnMobile: true });
  }
}

function insertChatEmote(tokenName) {
  const input = document.getElementById('chat-input');
  if (!input || !tokenName) return;
  document.querySelector('.chat-emote-picker')?.classList.remove('open');
  const tokenText = `:${tokenName}:`;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const spacerBefore = before && !/\s$/.test(before) ? ' ' : '';
  const spacerAfter = after && !/^\s/.test(after) ? ' ' : '';
  input.value = before + spacerBefore + tokenText + spacerAfter + after;
  const pos = before.length + spacerBefore.length + tokenText.length + spacerAfter.length;
  input.focus();
  input.setSelectionRange(pos, pos);
}

function isDesktopChatPanel() {
  const panel = document.getElementById('chat-panel');
  return panel && getComputedStyle(panel).position !== 'fixed';
}

function clampChatPanelWidth(width) {
  const viewport = window.innerWidth || 0;
  const min = 320;
  const max = Math.max(min, Math.min(720, Math.round(viewport * 0.55)));
  return Math.max(min, Math.min(max, Math.round(width)));
}

function setChatPanelWidth(width) {
  const app = document.getElementById('app');
  app?.style.setProperty('--chat-panel-width', `${clampChatPanelWidth(width)}px`);
}

function initChatPanelResize() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  let resizing = false;

  panel.addEventListener('pointerdown', event => {
    if (!isDesktopChatPanel() || event.clientX - panel.getBoundingClientRect().left > 10) return;
    resizing = true;
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  panel.addEventListener('pointermove', event => {
    if (!resizing) return;
    const width = window.innerWidth - event.clientX;
    setChatPanelWidth(width);
  });

  const finishResize = event => {
    if (!resizing) return;
    resizing = false;
    panel.releasePointerCapture?.(event.pointerId);
  };
  panel.addEventListener('pointerup', finishResize);
  panel.addEventListener('pointercancel', finishResize);
}

function shouldCloseChatForCardFocus() {
  const panel = document.getElementById('chat-panel');
  const panelIsOverlay = panel ? getComputedStyle(panel).position === 'fixed' : false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const narrowViewport = (window.visualViewport?.width || window.innerWidth || 0) <= 900;
  return panelIsOverlay || (coarsePointer && narrowViewport);
}

function scrollAndFlashCard(card) {
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  clearTimeout(card._flashTimer);
  card.classList.remove('card-flash');
  void card.offsetWidth;
  card.classList.add('card-flash');
  card._flashTimer = setTimeout(() => {
    card.classList.remove('card-flash');
    card._flashTimer = null;
  }, 1000);
}

function focusCard(itemId, { closeChatOnMobile = false } = {}) {
  const card = document.getElementById('card-' + itemId);
  if (!card) {
    showToast('Card is not available yet');
    return;
  }
  if (closeChatOnMobile && chatPanelOpen && shouldCloseChatForCardFocus()) {
    toggleChatPanel(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollAndFlashCard(card));
    });
    return;
  }
  scrollAndFlashCard(card);
}

function toggleChatPanel(forceOpen = null) {
  chatPanelOpen = forceOpen === null ? !chatPanelOpen : !!forceOpen;
  const app = document.getElementById('app');
  const panel = document.getElementById('chat-panel');
  const btn = document.getElementById('btn-chat');
  app?.classList.toggle('chat-open', chatPanelOpen);
  panel?.setAttribute('aria-hidden', chatPanelOpen ? 'false' : 'true');
  btn?.classList.toggle('active', chatPanelOpen);
  if (chatPanelOpen) {
    unreadChatCount = 0;
    updateChatUnreadBadge();
    updateChatViewportHeight();
    renderChatMessages();
    scrollChatToLatest();
    setTimeout(() => document.getElementById('chat-input')?.focus(), 150);
  }
}

function updateChatViewportHeight() {
  const panel = document.getElementById('chat-panel');
  if (!panel || !window.visualViewport) return;
  panel.style.setProperty('--chat-viewport-height', `${window.visualViewport.height}px`);
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;
  appendChatMessage(chatMessageFromSelf(text), { broadcast: true });
  clearChatReplyTarget();
  input.value = '';
}

function clearChat({ broadcast = false } = {}) {
  if (!chatMessages.length) return;
  chatMessages.length = 0;
  chatReplyTargetId = null;
  unreadChatCount = 0;
  updateChatUnreadBadge();
  saveChatMessages();
  renderChatReplyTarget();
  renderChatMessages();
  if (broadcast) wsSend({ type: 'relay', payload: { type: 'chat_cleared', clearedAt: Date.now() } });
}

function chatTranscriptText() {
  return chatMessages.map(message => {
    const identity = chatAuthorIdentity(message);
    const stamp = new Date(message.addedAt).toLocaleString();
    const reply = message.replyTo ? ` reply to ${message.replyTo.authorName}: "${message.replyTo.text}"` : '';
    const text = message.text || (message.card ? `[card: ${message.card.filename}]` : '');
    return `[${stamp}] ${identity.fullName}${message.authorId === clientId ? ' (You)' : ''}${reply}: ${text}`;
  }).join('\n');
}

function archiveChatAsCard() {
  if (!chatMessages.length) {
    showToast('No chat to archive');
    return;
  }
  const item = {
    id: randomUUID(),
    type: 'text',
    content: chatTranscriptText(),
    addedAt: Date.now(),
  };
  addAndBroadcast(item);
  showToast('Chat archived as a shared card');
}

function archiveAndClearChat() {
  if (!chatMessages.length) {
    showToast('No chat to archive');
    return;
  }
  archiveChatAsCard();
  clearChat({ broadcast: true });
}

function sendChatHistory(targetClientId) {
  if (!targetClientId || !chatMessages.length) return;
  wsSend({ type: 'relay', targetId: targetClientId, payload: { type: 'sync_state', items: [], chatMessages } });
}

// ── Transfer scheduling & outbound tracking ──────────────────────────
const connectedPeers = new Map(); // peerId -> {label: string}
const peerCardMetadata = new Map(); // peerId -> Map<itemId, metadata>
const roomManifest = new Map(); // itemId -> {ownerId, revision, meta}
const manifestRevisions = new Map();
const peerCompatibilityTimers = new Map();
const webRtcPeers = new Map(); // peerId -> {pc, channel, state, initiator, heartbeatTimer, pendingCandidates}
const webRtcStartTimers = new Map();
let webRtcConfig = null;
let webRtcConfigPromise = null;
let selfPeerInfo = { label: '1', ip: '' };
let peerCounter = 0;
const outboundTransfers = new Map(); // itemId -> Map<trackKey, {sent,total,startTime}>
const remoteTransferStatuses = new Map(); // transferKey -> transfer status from other clients
const transferStatusPublishTimes = new Map();
const downloadSourceRetryTimers = new Map();
const downloadSourceRetryAttempts = new Map();
const pendingDownloadSourceIds = new Map();
const pendingDownloadTriedSources = new Map();
const pendingChunkRequestBatches = new Map();
const downloadLogSources = new Map();
let sendWakeLock = null;
let sendWakeLockRequest = null;

function isWebRtcSupported() {
  return typeof RTCPeerConnection === 'function';
}

function sanitizeIceServers(iceServers) {
  if (!Array.isArray(iceServers)) return [];
  return iceServers
    .filter(server => server && (typeof server.urls === 'string' || Array.isArray(server.urls)))
    .map(server => ({
      urls: server.urls,
      ...(typeof server.username === 'string' ? { username: server.username } : {}),
      ...(typeof server.credential === 'string' ? { credential: server.credential } : {}),
    }));
}

async function loadWebRtcConfig() {
  if (webRtcConfig) return webRtcConfig;
  if (webRtcConfigPromise) return webRtcConfigPromise;
  webRtcConfigPromise = fetch('/webrtc-config', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : WEBRTC_ICE_CONFIG_FALLBACK)
    .then(config => {
      webRtcConfig = { iceServers: sanitizeIceServers(config?.iceServers) };
      return webRtcConfig;
    })
    .catch(() => {
      webRtcConfig = WEBRTC_ICE_CONFIG_FALLBACK;
      return webRtcConfig;
    })
    .finally(() => { webRtcConfigPromise = null; });
  return webRtcConfigPromise;
}

function webRtcStartBlockReason(peerId) {
  if (!peerId) return 'Peer id is missing';
  if (peerId === clientId) return 'This device has no WebRTC peer connection to itself';
  if (!isWebRtcSupported()) return 'RTCPeerConnection is not available in this browser';
  if (!encryptionKey) return 'Room passphrase key is not available';
  const peer = connectedPeers.get(peerId);
  if (!peer) return 'Peer is not connected through the relay';
  if (peer.compatibility !== 'compatible') return `Waiting for compatible key proof (${peer.compatibility || 'unknown'})`;
  return '';
}

function webRtcPeerState(peerId) {
  if (peerId === clientId) return 'self';
  if (!isWebRtcSupported()) return 'unavailable';
  const record = webRtcPeers.get(peerId);
  if (record?.state) return record.state;
  const peer = connectedPeers.get(peerId);
  if (peer?.compatibility === 'compatible') {
    scheduleWebRtcStart(peerId);
    return 'starting';
  }
  return 'unavailable';
}

function webRtcUnavailableReason(peerId) {
  const startBlockReason = webRtcStartBlockReason(peerId);
  if (startBlockReason) return startBlockReason;
  if (!webRtcPeers.has(peerId)) return 'Peer connection is starting';
  return '';
}

function webRtcStateLabel(peerId) {
  const state = webRtcPeerState(peerId);
  if (state === 'self') return 'This device';
  if (state === 'connected') return 'WebRTC connected';
  if (state === 'starting') return 'WebRTC starting';
  if (state === 'connecting') return 'WebRTC connecting';
  if (state === 'failed') return 'WebRTC failed';
  return 'WebRTC unavailable';
}

function refreshWebRtcUi() {
  updatePeerCount();
  schedulePeersModalRefresh();
}

function setWebRtcPeerState(peerId, state) {
  const record = webRtcPeers.get(peerId);
  if (record) {
    record.state = state;
    record.updatedAt = Date.now();
    record.connectionState = record.pc?.connectionState || '';
    record.iceConnectionState = record.pc?.iceConnectionState || '';
    record.iceGatheringState = record.pc?.iceGatheringState || '';
    record.signalingState = record.pc?.signalingState || '';
    record.channelState = record.channel?.readyState || '';
  }
  const peer = connectedPeers.get(peerId);
  if (peer) peer.webrtcState = state;
  refreshWebRtcUi();
}

function setWebRtcStartFailed(peerId, error) {
  const message = error?.message || String(error || 'WebRTC start failed');
  let record = webRtcPeers.get(peerId);
  if (!record) {
    record = {
      pc: null,
      channel: null,
      state: 'failed',
      initiator: clientId < peerId,
      heartbeatTimer: null,
      pendingCandidates: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      iceCandidatesSent: 0,
      iceCandidatesReceived: 0,
      lastSignalSentAt: null,
      lastSignalSentType: '',
      lastSignalReceivedAt: null,
      lastSignalReceivedType: '',
      connectionState: '',
      iceConnectionState: '',
      iceGatheringState: '',
      signalingState: '',
      channelState: '',
      error: message,
      startBlockedReason: message,
      startAttempts: 1,
      lastStartAttemptAt: Date.now(),
    };
    webRtcPeers.set(peerId, record);
  } else {
    record.state = 'failed';
    record.error = message;
    record.startBlockedReason = message;
    record.startAttempts = (record.startAttempts || 0) + 1;
    record.lastStartAttemptAt = Date.now();
    record.updatedAt = Date.now();
  }
  const peer = connectedPeers.get(peerId);
  if (peer) peer.webrtcState = 'failed';
  refreshWebRtcUi();
}

function scheduleWebRtcStart(peerId) {
  if (!peerId || peerId === clientId || webRtcPeers.has(peerId) || webRtcStartTimers.has(peerId)) return;
  if (webRtcStartBlockReason(peerId)) return;
  const timer = setTimeout(() => {
    webRtcStartTimers.delete(peerId);
    ensureWebRtcPeer(peerId)
      .then(record => {
        if (!record) setWebRtcStartFailed(peerId, new Error(webRtcStartBlockReason(peerId) || 'WebRTC peer creation returned no record'));
      })
      .catch(error => setWebRtcStartFailed(peerId, error));
  }, 0);
  webRtcStartTimers.set(peerId, timer);
}

function closeWebRtcPeer(peerId, state = 'unavailable') {
  const timer = webRtcStartTimers.get(peerId);
  if (timer) {
    clearTimeout(timer);
    webRtcStartTimers.delete(peerId);
  }
  const record = webRtcPeers.get(peerId);
  if (record) {
    if (record.heartbeatTimer) clearInterval(record.heartbeatTimer);
    try { record.channel?.close(); } catch { }
    try { record.pc?.close(); } catch { }
    webRtcPeers.delete(peerId);
  }
  const peer = connectedPeers.get(peerId);
  if (peer) peer.webrtcState = state;
  refreshWebRtcUi();
}

function closeAllWebRtcPeers() {
  for (const peerId of [...webRtcPeers.keys()]) closeWebRtcPeer(peerId);
  for (const timer of webRtcStartTimers.values()) clearTimeout(timer);
  webRtcStartTimers.clear();
  webRtcConfigPromise = null;
}

function sendWebRtcSignal(peerId, payload) {
  if (!peerId || !payload?.type) return false;
  const record = webRtcPeers.get(peerId);
  if (record) {
    record.lastSignalSentAt = Date.now();
    record.lastSignalSentType = payload.type;
    if (payload.type === 'webrtc_ice') record.iceCandidatesSent = (record.iceCandidatesSent || 0) + 1;
  }
  return wsSend({ type: 'relay', targetId: peerId, payload }, null, true);
}

function sendWebRtcChannelJson(peerId, payload) {
  const channel = webRtcPeers.get(peerId)?.channel;
  if (!channel || channel.readyState !== 'open') return false;
  try {
    channel.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function webRtcChannelOpen(peerId) {
  return webRtcPeers.get(peerId)?.channel?.readyState === 'open';
}

async function drainWebRtcChannel(peerId) {
  const channel = webRtcPeers.get(peerId)?.channel;
  if (!channel || channel.readyState !== 'open') return false;
  const highWater = BINARY_CHUNK_SIZE * 2;
  const start = Date.now();
  while (channel.readyState === 'open' && channel.bufferedAmount > highWater) {
    await sleep(8);
    if (Date.now() - start > 10000) break;
  }
  return channel.readyState === 'open';
}

async function sendWebRtcBinaryFrame(peerId, frame) {
  const channel = webRtcPeers.get(peerId)?.channel;
  if (!channel || channel.readyState !== 'open') return false;
  if (!await drainWebRtcChannel(peerId)) return false;
  try {
    channel.send(frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength));
    return true;
  } catch (error) {
    debugLog('webrtc-binary-send-failed', { peerId, error: error?.message || String(error) });
    return false;
  }
}

function handleWebRtcChannelMessage(peerId, event) {
  if (event.data instanceof ArrayBuffer) {
    handleBinaryMessage(event.data, 'webrtc');
    return;
  }
  if (event.data instanceof Blob) {
    event.data.arrayBuffer().then(buffer => handleBinaryMessage(buffer, 'webrtc')).catch(() => {});
    return;
  }
  let msg = null;
  try {
    msg = JSON.parse(String(event.data || ''));
  } catch {
    return;
  }
  if (msg?.type === 'webrtc_ping') {
    sendWebRtcChannelJson(peerId, { type: 'webrtc_pong', sentAt: msg.sentAt, receivedAt: Date.now() });
  } else if (msg?.type === 'webrtc_pong') {
    const peer = connectedPeers.get(peerId);
    if (peer) peer.webrtcLastPongAt = Date.now();
  }
}

function attachWebRtcChannel(peerId, channel) {
  const record = webRtcPeers.get(peerId);
  if (!record || !channel) return;
  record.channel = channel;
  channel.binaryType = 'arraybuffer';
  channel.onopen = () => {
    setWebRtcPeerState(peerId, 'connected');
    sendWebRtcChannelJson(peerId, { type: 'webrtc_ping', sentAt: Date.now() });
    if (record.heartbeatTimer) clearInterval(record.heartbeatTimer);
    record.heartbeatTimer = setInterval(() => {
      sendWebRtcChannelJson(peerId, { type: 'webrtc_ping', sentAt: Date.now() });
    }, WEBRTC_HEARTBEAT_INTERVAL_MS);
  };
  channel.onmessage = event => handleWebRtcChannelMessage(peerId, event);
  channel.onclose = () => {
    if (record.heartbeatTimer) clearInterval(record.heartbeatTimer);
    record.heartbeatTimer = null;
    if (webRtcPeers.has(peerId) && webRtcPeerState(peerId) === 'connected') setWebRtcPeerState(peerId, 'connecting');
  };
  channel.onerror = () => setWebRtcPeerState(peerId, 'failed');
}

async function addQueuedWebRtcCandidates(peerId) {
  const record = webRtcPeers.get(peerId);
  if (!record?.pc?.remoteDescription) return;
  const queued = record.pendingCandidates.splice(0);
  for (const candidate of queued) {
    try { await record.pc.addIceCandidate(candidate); } catch { }
  }
}

async function ensureWebRtcPeer(peerId) {
  const startBlockReason = webRtcStartBlockReason(peerId);
  if (startBlockReason) throw new Error(startBlockReason);
  const peer = connectedPeers.get(peerId);
  const existing = webRtcPeers.get(peerId);
  if (existing?.pc && existing.pc.connectionState !== 'closed') return existing;
  if (existing) closeWebRtcPeer(peerId, 'connecting');

  const config = await loadWebRtcConfig();
  const pc = new RTCPeerConnection(config);
  const record = {
    pc,
    channel: null,
    state: 'connecting',
    initiator: clientId < peerId,
    heartbeatTimer: null,
    pendingCandidates: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    iceCandidatesSent: 0,
    iceCandidatesReceived: 0,
    lastSignalSentAt: null,
    lastSignalSentType: '',
    lastSignalReceivedAt: null,
    lastSignalReceivedType: '',
    connectionState: pc.connectionState || '',
    iceConnectionState: pc.iceConnectionState || '',
    iceGatheringState: pc.iceGatheringState || '',
    signalingState: pc.signalingState || '',
    channelState: '',
    error: '',
    startBlockedReason: '',
    startAttempts: 1,
    lastStartAttemptAt: Date.now(),
  };
  webRtcPeers.set(peerId, record);
  peer.webrtcState = 'connecting';

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendWebRtcSignal(peerId, { type: 'webrtc_ice', candidate: event.candidate.toJSON?.() || event.candidate });
    }
  };
  pc.ondatachannel = event => attachWebRtcChannel(peerId, event.channel);
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'connected') setWebRtcPeerState(peerId, 'connected');
    else if (state === 'failed' || state === 'disconnected') setWebRtcPeerState(peerId, 'failed');
    else if (state === 'closed') closeWebRtcPeer(peerId);
    else setWebRtcPeerState(peerId, 'connecting');
  };
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') setWebRtcPeerState(peerId, 'failed');
  };

  if (record.initiator) {
    attachWebRtcChannel(peerId, pc.createDataChannel('clipshare-control', { ordered: true }));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    record.localDescriptionType = pc.localDescription?.type || '';
    sendWebRtcSignal(peerId, { type: 'webrtc_offer', sdp: pc.localDescription });
  }

  refreshWebRtcUi();
  return record;
}

function startWebRtcForCompatiblePeers() {
  return Promise.all([...connectedPeers.entries()]
    .filter(([, peer]) => peer.compatibility === 'compatible')
    .map(async ([peerId]) => {
      try {
        const record = await ensureWebRtcPeer(peerId);
        if (!record) setWebRtcStartFailed(peerId, new Error(webRtcStartBlockReason(peerId) || 'WebRTC peer creation returned no record'));
        return record;
      } catch (error) {
        setWebRtcStartFailed(peerId, error);
        return null;
      }
    }));
}

async function handleWebRtcOffer(payload, senderId) {
  if (!payload?.sdp || !senderId || senderId === clientId) return;
  const peer = connectedPeers.get(senderId);
  if (!peer || peer.compatibility !== 'compatible') return;
  try {
    const record = await ensureWebRtcPeer(senderId);
    if (!record?.pc) return;
    record.lastSignalReceivedAt = Date.now();
    record.lastSignalReceivedType = payload.type;
    await record.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    record.remoteDescriptionType = payload.sdp?.type || '';
    await addQueuedWebRtcCandidates(senderId);
    const answer = await record.pc.createAnswer();
    await record.pc.setLocalDescription(answer);
    record.localDescriptionType = record.pc.localDescription?.type || '';
    sendWebRtcSignal(senderId, { type: 'webrtc_answer', sdp: record.pc.localDescription });
  } catch {
    setWebRtcPeerState(senderId, 'failed');
  }
}

async function handleWebRtcAnswer(payload, senderId) {
  const record = webRtcPeers.get(senderId);
  if (!payload?.sdp || !record?.pc) return;
  try {
    record.lastSignalReceivedAt = Date.now();
    record.lastSignalReceivedType = payload.type;
    if (!record.pc.remoteDescription) {
      await record.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      record.remoteDescriptionType = payload.sdp?.type || '';
      await addQueuedWebRtcCandidates(senderId);
    }
  } catch {
    setWebRtcPeerState(senderId, 'failed');
  }
}

async function handleWebRtcIce(payload, senderId) {
  try {
    const record = webRtcPeers.get(senderId) || await ensureWebRtcPeer(senderId);
    if (!payload?.candidate || !record?.pc) return;
    record.lastSignalReceivedAt = Date.now();
    record.lastSignalReceivedType = payload.type;
    record.iceCandidatesReceived = (record.iceCandidatesReceived || 0) + 1;
    const candidate = new RTCIceCandidate(payload.candidate);
    if (!record.pc.remoteDescription) {
      record.pendingCandidates.push(candidate);
      return;
    }
    await record.pc.addIceCandidate(candidate);
  } catch {
    setWebRtcPeerState(senderId, 'failed');
  }
}

function hasPendingChunkSends() {
  return !!chunkScheduler?.hasPending();
}

function shouldHoldSendWakeLock() {
  return detectDeviceType() === 'mobile'
    && document.visibilityState === 'visible'
    && (hasPendingChunkSends() || outboundTransfers.size > 0);
}

async function acquireSendWakeLock() {
  if (!('wakeLock' in navigator) || sendWakeLock || sendWakeLockRequest || !shouldHoldSendWakeLock()) return;
  sendWakeLockRequest = navigator.wakeLock.request('screen')
    .then(lock => {
      sendWakeLock = lock;
      sendWakeLock.addEventListener('release', () => {
        sendWakeLock = null;
        updateSendWakeLock();
      }, { once: true });
    })
    .catch(() => {})
    .finally(() => {
      sendWakeLockRequest = null;
      if (!shouldHoldSendWakeLock()) releaseSendWakeLock();
    });
  await sendWakeLockRequest;
}

function releaseSendWakeLock() {
  const lock = sendWakeLock;
  sendWakeLock = null;
  if (lock) lock.release().catch(() => {});
}

function updateSendWakeLock() {
  if (shouldHoldSendWakeLock()) acquireSendWakeLock();
  else releaseSendWakeLock();
}

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
    updateSendWakeLock();
    return entry;
  }
  cancelItem(itemId) {
    for (const e of this.queue) if (e.itemId === itemId) e.cancel();
    updateSendWakeLock();
  }
  hasPending() {
    return this.running || this.queue.some(e => !e.cancelled);
  }
  async _run() {
    if (this.running) return;
    this.running = true;
    updateSendWakeLock();
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
      updateSendWakeLock();
    }
  }
}
const chunkScheduler = new ChunkScheduler();

// ── Startup ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    document.getElementById('https-warning').style.display = 'block';
  }
  loadWebRtcConfig().catch(() => {});

  document.getElementById('btn-join').addEventListener('click', joinFromInput);
  document.getElementById('btn-create').addEventListener('click', regenerateTokenInput);
  document.getElementById('modal-start-pairing')?.addEventListener('click', () => startPairingMode({ modal: true }));
  document.getElementById('copy-start-url-btn').addEventListener('click', async () => {
    const url = document.getElementById('start-share-url').textContent;
    if (!url) return;
    try { await navigator.clipboard.writeText(url); showToast('URL copied!'); } catch { showToast(url); }
  });
  document.getElementById('token-input').addEventListener('input', e => {
    e.target.value = formatToken(e.target.value);
    if (startPairingCreated && normalizeToken(e.target.value) !== token) stopPairingMode({ start: true });
    updateStartSharePreview();
  });
  document.getElementById('pin-input').addEventListener('input', e => { e.target.value = formatPairingPinInput(e.target.value); clearPinError(); });
  document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinFromInput(); });
  document.getElementById('pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinFromInput(); });
  document.getElementById('btn-clear').addEventListener('click', openClearModal);
  document.getElementById('btn-leave').addEventListener('click', openLeaveModal);
  document.getElementById('btn-paste').addEventListener('click', paste);
  document.getElementById('btn-upload').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('btn-new-text').addEventListener('click', createTextCard);
  document.getElementById('btn-chat').addEventListener('click', () => toggleChatPanel());
  document.getElementById('chat-close').addEventListener('click', () => toggleChatPanel(false));
  document.getElementById('chat-archive').addEventListener('click', openChatArchiveModal);
  document.getElementById('chat-clear').addEventListener('click', openChatClearModal);
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
  document.getElementById('chat-card-add').addEventListener('click', () => document.getElementById('chat-file-input').click());
  initChatPanelResize();
  document.querySelector('.chat-emote-toggle')?.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelector('.chat-emote-picker')?.classList.toggle('open');
  });
  document.getElementById('chat-messages').addEventListener('click', handleChatMessageClick);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  document.getElementById('file-input').addEventListener('change', e => handleFiles(e.target.files));
  document.getElementById('chat-file-input').addEventListener('change', e => {
    handleFiles(e.target.files, { mentionInChat: true });
    e.target.value = '';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.chat-emote-picker')) {
      document.querySelector('.chat-emote-picker')?.classList.remove('open');
    }
    if (!e.target.closest('.chat-reaction-dropdown')) {
      document.querySelectorAll('.chat-reaction-dropdown.open').forEach(el => el.classList.remove('open'));
    }
  });
  document.getElementById('header-token').addEventListener('click', openTokenModal);
  document.getElementById('header-logo').addEventListener('dblclick', exportDiagnostics);
  document.getElementById('peer-pills').addEventListener('click', openPeersModal);
  document.getElementById('token-modal-close').addEventListener('click', closeTokenModal);
  document.getElementById('token-modal').addEventListener('click', e => { if (e.target.id === 'token-modal') closeTokenModal(); });
  document.getElementById('copy-token-btn').addEventListener('click', copyToken);
  document.getElementById('copy-url-btn').addEventListener('click', copyShareUrl);
  document.getElementById('peers-modal-close').addEventListener('click', closePeersModal);
  document.getElementById('peers-modal').addEventListener('click', e => { if (e.target.id === 'peers-modal') closePeersModal(); });
  document.getElementById('peer-detail-modal-close').addEventListener('click', closePeerDetailModal);
  document.getElementById('peer-detail-modal').addEventListener('click', e => { if (e.target.id === 'peer-detail-modal') closePeerDetailModal(); });
  document.getElementById('clear-modal').addEventListener('click', e => { if (e.target.id === 'clear-modal') closeClearModal(); });
  document.getElementById('chat-archive-modal').addEventListener('click', e => { if (e.target.id === 'chat-archive-modal') closeChatArchiveModal(); });
  document.getElementById('chat-clear-modal').addEventListener('click', e => { if (e.target.id === 'chat-clear-modal') closeChatClearModal(); });
  document.getElementById('leave-modal').addEventListener('click', e => { if (e.target.id === 'leave-modal') closeLeaveModal(); });
  document.getElementById('clear-cancel').addEventListener('click', closeClearModal);
  document.getElementById('clear-confirm').addEventListener('click', () => { closeClearModal(); clearAllItems(); });
  document.getElementById('chat-archive-cancel').addEventListener('click', closeChatArchiveModal);
  document.getElementById('chat-archive-confirm').addEventListener('click', () => { closeChatArchiveModal(); archiveAndClearChat(); });
  document.getElementById('chat-clear-cancel').addEventListener('click', closeChatClearModal);
  document.getElementById('chat-clear-confirm').addEventListener('click', () => { closeChatClearModal(); clearChat({ broadcast: true }); });
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
    updateSendWakeLock();
  });
  window.addEventListener('focus', () => {
    checkForegroundFreshness();
    updateSendWakeLock();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateChatViewportHeight);
    window.visualViewport.addEventListener('scroll', updateChatViewportHeight);
  }

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
  const savedToken = normalizeToken(localStorage.getItem('clipshare_token'));
  const savedPassphrase = localStorage.getItem('clipshare_passphrase') || '';
  if (pathToken && isGeneratedPasskey(hashPassphrase)) {
    currentPassphrase = hashPassphrase;
    saveTokenInputsToStorage(pathToken, currentPassphrase);
    setToken(pathToken);
  } else if (pathToken && pathToken === savedToken && isGeneratedPasskey(savedPassphrase)) {
    currentPassphrase = savedPassphrase;
    localStorage.setItem('clipshare_passphrase', currentPassphrase);
    setToken(pathToken);
  } else {
    loadTokenInputsFromStorage();
    if (pathToken) {
      document.getElementById('token-input').value = formatToken(pathToken);
      history.replaceState({}, '', '/');
    }
  }
  renderChatEmotes();
  renderChatMessages();
  renderChatReplyTarget();
  updateChatUnreadBadge();
  setInterval(() => {
    refreshCardTimes();
    if (chatPanelOpen) renderChatMessages();
  }, 30000);
  refreshIcons();
});

const PAKE_GROUP_P_HEX = `
FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08
8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B
302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9
A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6
49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8
FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D
670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C
180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718
3995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFF
FFFFFFFF`;
const PAKE_GROUP_P = BigInt('0x' + PAKE_GROUP_P_HEX.replace(/\s+/g, ''));
const PAKE_GROUP_Q = (PAKE_GROUP_P - 1n) / 2n;

function modPow(base, exponent, mod) {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const raw = String(value || '');
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function bigIntToBytes(value) {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToBigInt(bytes) {
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + (hex || '0'));
}

function bigIntToBase64Url(value) {
  return bytesToBase64Url(bigIntToBytes(value));
}

function base64UrlToBigInt(value) {
  return bytesToBigInt(base64UrlToBytes(value));
}

function concatBytes(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function sha256Bytes(...parts) {
  const digest = await crypto.subtle.digest('SHA-256', concatBytes(...parts));
  return new Uint8Array(digest);
}

function randomPakeScalar() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (bytesToBigInt(bytes) % (PAKE_GROUP_Q - 2n)) + 2n;
}

function isValidPakePublic(value) {
  return value > 1n && value < PAKE_GROUP_P - 1n && modPow(value, PAKE_GROUP_Q, PAKE_GROUP_P) === 1n;
}

async function pakeGenerator(pin, tokenValue, hostId, requestId) {
  const encoder = new TextEncoder();
  const seed = await sha256Bytes(encoder.encode(`ClipShare SPEKE v1|${tokenValue}|${hostId}|${requestId}|${pin}`));
  const candidate = (bytesToBigInt(seed) % (PAKE_GROUP_P - 3n)) + 2n;
  const generator = modPow(candidate, 2n, PAKE_GROUP_P);
  return generator > 1n ? generator : 4n;
}

async function makePakeStart(pin, tokenValue, hostId, requestId) {
  const secret = randomPakeScalar();
  const generator = await pakeGenerator(pin, tokenValue, hostId, requestId);
  const publicValue = modPow(generator, secret, PAKE_GROUP_P);
  return {
    secret,
    start: {
      version: 'speke-v1',
      group: 'rfc3526-2048',
      A: bigIntToBase64Url(publicValue),
    },
  };
}

async function derivePakeKey(pin, tokenValue, hostId, requestId, secret, peerPublic, aPublic, bPublic) {
  if (!isValidPakePublic(aPublic) || !isValidPakePublic(bPublic) || !isValidPakePublic(peerPublic)) {
    throw new Error('invalid PAKE public value');
  }
  const shared = modPow(peerPublic, secret, PAKE_GROUP_P);
  const encoder = new TextEncoder();
  const material = await sha256Bytes(
    encoder.encode('ClipShare PAKE key v1'),
    bigIntToBytes(shared),
    encoder.encode(`${tokenValue}|${hostId}|${requestId}|${bigIntToBase64Url(aPublic)}|${bigIntToBase64Url(bPublic)}`)
  );
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptPakeJson(key, payload, aad) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(JSON.stringify(payload))
  );
  return {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  };
}

async function decryptPakeJson(key, encryptedPayload, aad) {
  const encoder = new TextEncoder();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(encryptedPayload?.iv || []),
      additionalData: encoder.encode(aad),
    },
    key,
    new Uint8Array(encryptedPayload?.ciphertext || [])
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function pairingIsActive() {
  return startPairingCreated || modalPairingActive;
}

function activeRemotePairingHost() {
  const now = Date.now();
  return [...pairingHosts.values()]
    .filter(host => Number(host.expiresAt) > now)
    .sort((a, b) => Number(a.expiresAt || 0) - Number(b.expiresAt || 0))[0] || null;
}

function pairingHostRemainingSeconds(host) {
  const expiresAt = Number(host?.pairingWindowExpiresAt || host?.expiresAt || 0);
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function pairingHostWindowDurationMs(host) {
  const maxUnusedPins = Math.max(1, Number(host?.maxUnusedPins) || PAIRING_MAX_UNUSED_PINS);
  const pinTimeoutMs = Math.max(1000, Number(host?.pinTimeoutMs) || PAIRING_PIN_TTL_MS);
  return maxUnusedPins * pinTimeoutMs;
}

function updateRemotePairingSpinner(host) {
  const expiresAt = Number(host?.pairingWindowExpiresAt || host?.expiresAt || 0);
  const duration = pairingHostWindowDurationMs(host);
  const remaining = Math.max(0, expiresAt - Date.now());
  const degrees = host ? Math.max(0, Math.min(360, remaining / duration * 360)) : 360;
  document.querySelectorAll('.remote-pairing-row .pairing-spinner').forEach(el => {
    el.style.animation = host ? 'none' : '';
    el.style.setProperty('--sp-deg', `${degrees}deg`);
  });
}

function pairingHostStatusText(host) {
  if (!host) return '';
  return `${peerDisplayName(host.clientId, host.peerNumber)} is in pairing mode`;
}

function setPinInputEnabled(enabled) {
  const input = document.getElementById('pin-input');
  if (input) input.disabled = !enabled;
}

function updatePairingUi() {
  const active = pairingIsActive() && pairingPin;
  const remaining = Math.max(0, Math.ceil((pairingPinExpiresAt - Date.now()) / 1000));
  const remoteHost = activeRemotePairingHost();
  const remoteSeconds = pairingHostRemainingSeconds(remoteHost);
  updateRemotePairingSpinner(!modalPairingActive && remoteHost ? remoteHost : null);
  const startBox = document.getElementById('start-pairing-pin');
  const modalBox = document.getElementById('modal-pairing-pin');
  const modalRemoteBox = document.getElementById('modal-remote-pairing');
  const modalRemoteTime = document.getElementById('modal-remote-pairing-time');
  const modalPairingLabel = document.getElementById('modal-pairing-label');
  const modalStartPairing = document.getElementById('modal-start-pairing');
  const pinField = document.getElementById('start-pin-field');
  const showPairing = startPairingCreated && active;
  if (startBox) startBox.style.display = showPairing ? '' : 'none';
  if (pinField) pinField.style.display = showPairing ? 'none' : '';
  const createBtn = document.getElementById('btn-create');
  if (createBtn) {
    createBtn.style.display = '';
    createBtn.innerHTML = startPairingCreated
      ? '<i data-lucide="refresh-cw"></i> Regenerate'
      : '<i data-lucide="plus"></i> Create space';
  }
  if (createBtn) lucide.createIcons({ nodes: [createBtn] });
  const showModalPin = modalPairingActive && active;
  const showModalRemote = !modalPairingActive && !!remoteHost;
  if (modalBox) modalBox.style.display = showModalPin ? '' : 'none';
  if (modalRemoteBox) modalRemoteBox.style.display = showModalRemote ? '' : 'none';
  if (modalRemoteTime) modalRemoteTime.textContent = showModalRemote ? `${remoteSeconds}s remaining` : '';
  if (modalPairingLabel) {
    if (showModalPin) modalPairingLabel.textContent = 'Pairing PIN';
    else if (showModalRemote) modalPairingLabel.textContent = pairingHostStatusText(remoteHost);
    else modalPairingLabel.textContent = 'Pairing';
  }
  if (modalStartPairing) modalStartPairing.style.display = (!showModalPin && !showModalRemote) ? '' : 'none';
  const pinHtml = pairingPin
    ? `<span>${pairingPin.slice(0, 4)}</span><span class="pin-sep" aria-hidden="true"> </span><span>${pairingPin.slice(4)}</span>`
    : '';
  const label = remaining ? `${remaining}s` : 'Refreshing';
  const startValue = document.getElementById('start-pin-value');
  const modalValue = document.getElementById('modal-pin-value');
  const startTime = document.getElementById('start-pin-time');
  const modalTime = document.getElementById('modal-pin-time');
  if (startValue) startValue.innerHTML = pinHtml;
  if (modalValue) modalValue.innerHTML = pinHtml;
  if (startTime) startTime.textContent = label;
  if (modalTime) modalTime.textContent = label;
  if (!active && !remoteHost) stopPairingUiTimer();
}

function stopPairingUiTimer() {
  if (pairingUiTimer) clearInterval(pairingUiTimer);
  pairingUiTimer = null;
}

function startPairingUiTimer() {
  stopPairingUiTimer();
  updatePairingUi();
  pairingUiTimer = setInterval(updatePairingUi, 250);
}

function pairingSocketUrl(tokenValue) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws/${encodeURIComponent(tokenValue)}?clientId=${clientId}&channel=control`;
}

function activePairingSocket() {
  return ws?.readyState === WebSocket.OPEN ? ws : pairingHostWs;
}

function sendPairingJson(msg) {
  const socket = activePairingSocket();
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(msg));
  return true;
}

function closePairingHostSocket() {
  if (pairingHostWs) {
    pairingHostWs.onclose = null;
    pairingHostWs.close();
    pairingHostWs = null;
  }
}

function ensurePairingHostSocket(tokenValue) {
  if (ws?.readyState === WebSocket.OPEN) return;
  if (pairingHostWs && pairingHostWs.readyState <= WebSocket.OPEN) return;
  pairingHostWs = new WebSocket(pairingSocketUrl(tokenValue));
  pairingHostWs.onmessage = async event => {
    try { await handleServerMessage(JSON.parse(event.data)); } catch {}
  };
  pairingHostWs.onopen = () => publishPairingMode();
  pairingHostWs.onclose = () => {
    if (pairingIsActive() && !ws) setTimeout(() => ensurePairingHostSocket(tokenValue), 1000);
  };
}

async function publishPairingMode() {
  if (!pairingIsActive() || !token || !pairingPinId || pairingPinExpiresAt <= Date.now()) return false;
  return sendPairingJson({
    type: 'pairing_mode',
    pairingVersion: 'speke-v1',
    pinId: pairingPinId,
    expiresAt: pairingPinExpiresAt,
  });
}

async function rotatePairingPin() {
  if (!pairingIsActive() || !token || !currentPassphrase) return;
  if (pairingPin && !pairingCurrentPinUsed) {
    pairingUnusedPinCount++;
    if (pairingUnusedPinCount >= PAIRING_MAX_UNUSED_PINS) {
      showToast('Pairing timed out');
      closeTokenModal();
      stopPairingMode({ all: true });
      return;
    }
  }
  pairingPin = generatePairingPin();
  pairingPinId = randomUUID();
  pairingCurrentPinUsed = false;
  pairingPinExpiresAt = Date.now() + PAIRING_PIN_TTL_MS;
  document.querySelectorAll('.pairing-spinner').forEach(el => {
    el.style.animation = 'none';
    el.offsetWidth;
    el.style.animation = `pin-countdown ${PAIRING_PIN_TTL_MS / 1000}s linear 1 forwards`;
  });
  startPairingUiTimer();
  ensurePairingHostSocket(token);
  await publishPairingMode();
  if (pairingRotateTimer) clearTimeout(pairingRotateTimer);
  pairingRotateTimer = setTimeout(rotatePairingPin, PAIRING_PIN_TTL_MS);
}

function stopPairingMode({ start = false, modal = false, all = false } = {}) {
  if (all || start) startPairingCreated = false;
  if (all || modal) modalPairingActive = false;
  if (pairingIsActive()) {
    updatePairingUi();
    return;
  }
  if (pairingRotateTimer) clearTimeout(pairingRotateTimer);
  pairingRotateTimer = null;
  stopPairingUiTimer();
  pairingPin = '';
  pairingPinId = '';
  pairingPinExpiresAt = 0;
  pairingUnusedPinCount = 0;
  pairingCurrentPinUsed = false;
  pairingHostPendingRequests.clear();
  sendPairingJson({ type: 'pairing_stop' });
  closePairingHostSocket();
  updatePairingUi();
}

async function startPairingMode({ start = false, modal = false } = {}) {
  if (!token || !currentPassphrase) return;
  if (modal && activeRemotePairingHost()) {
    showToast(pairingHostStatusText(activeRemotePairingHost()));
    updatePairingUi();
    return;
  }
  if (start) startPairingCreated = true;
  if (modal) modalPairingActive = true;
  if (!pairingPin || pairingPinExpiresAt <= Date.now()) await rotatePairingPin();
  else {
    startPairingUiTimer();
    ensurePairingHostSocket(token);
    await publishPairingMode();
  }
}

function updatePairingHosts(hosts = []) {
  pairingHosts.clear();
  for (const host of hosts || []) {
    if (!host?.clientId || host.clientId === clientId || host.pairingVersion !== 'speke-v1') continue;
    if (Number(host.expiresAt) <= Date.now()) continue;
    pairingHosts.set(host.clientId, host);
  }
  if (activeRemotePairingHost() && !pairingUiTimer) startPairingUiTimer();
  else updatePairingUi();
}

function closePairingJoinSocket() {
  if (pairingJoinWs) {
    pairingJoinWs.onclose = null;
    pairingJoinWs.close();
    pairingJoinWs = null;
  }
}

function clearPairingJoinTimer() {
  if (pairingJoinTimer) clearTimeout(pairingJoinTimer);
  pairingJoinTimer = null;
}

function resetPairingJoin() {
  clearPairingJoinTimer();
  pairingJoinPakeSecret = null;
  pairingJoinPakeStart = null;
  pairingJoinRequestId = null;
  pairingJoinToken = '';
  closePairingJoinSocket();
}

function showPinError(msg) {
  const el = document.getElementById('pin-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
}

function clearPinError() {
  const el = document.getElementById('pin-error');
  if (el) el.style.display = 'none';
}

function pairingJoinFailed(message = 'Invalid PIN') {
  showPinError(message);
  resetPairingJoin();
  setPinInputEnabled(true);
}

async function requestPairingWithHosts() {
  const pin = (document.getElementById('pin-input')?.value || '').replace(/\D/g, '');
  if (!pairingJoinWs || pairingJoinWs.readyState !== WebSocket.OPEN || !pin || pin.length !== PAIRING_PIN_LENGTH) return;
  const hosts = [...pairingHosts.values()].filter(host => Number(host.expiresAt) > Date.now());
  if (!hosts.length) {
    pairingJoinFailed('No peer found with an active pairing PIN on this token');
    return;
  }
  const host = hosts[0];
  pairingJoinRequestId = randomUUID();
  const pake = await makePakeStart(pin, pairingJoinToken, host.clientId, pairingJoinRequestId);
  pairingJoinPakeSecret = pake.secret;
  pairingJoinPakeStart = {
    hostId: host.clientId,
    hostPeerNumber: host.peerNumber,
    A: pake.start.A,
    pin,
  };
  pairingJoinWs.send(JSON.stringify({
    type: 'pairing_request',
    requestId: pairingJoinRequestId,
    hostIds: [host.clientId],
    pakeStart: pake.start,
  }));
  clearPairingJoinTimer();
  pairingJoinTimer = setTimeout(() => pairingJoinFailed('Invalid PIN'), PAIRING_JOIN_TIMEOUT_MS);
}

async function handlePairingJoinMessage(msg) {
  if (msg.type === 'welcome' || msg.type === 'pairing_hosts') {
    updatePairingHosts(msg.pairingHosts || msg.hosts || []);
    await requestPairingWithHosts();
    return;
  }
  if (msg.type !== 'pairing_response' || msg.requestId !== pairingJoinRequestId || !pairingJoinPakeSecret || !pairingJoinPakeStart) return;
  try {
    const bPublic = base64UrlToBigInt(msg.pakeFinish?.B);
    const aPublic = base64UrlToBigInt(pairingJoinPakeStart.A);
    const key = await derivePakeKey(
      pairingJoinPakeStart.pin,
      pairingJoinToken,
      pairingJoinPakeStart.hostId,
      pairingJoinRequestId,
      pairingJoinPakeSecret,
      bPublic,
      aPublic,
      bPublic
    );
    const aad = `ClipShare PAKE response v1|${pairingJoinToken}|${pairingJoinPakeStart.hostId}|${pairingJoinRequestId}|${pairingJoinPakeStart.A}|${msg.pakeFinish?.B || ''}`;
    const payload = await decryptPakeJson(key, msg.encryptedPassphrase, aad);
    if (payload?.kind !== 'clipshare-pairing-passphrase' || !isGeneratedPasskey(payload.passphrase)) throw new Error('bad passphrase');
    const pairedToken = pairingJoinToken;
    const pairedHostId = pairingJoinPakeStart.hostId;
    const pairedRequestId = pairingJoinRequestId;
    const pairedDeviceName = peerDisplayName(pairingJoinPakeStart.hostId, pairingJoinPakeStart.hostPeerNumber);
    currentPassphrase = payload.passphrase;
    saveTokenInputsToStorage(pairedToken, currentPassphrase);
    if (pairingJoinWs?.readyState === WebSocket.OPEN) {
      pairingJoinWs.send(JSON.stringify({
        type: 'pairing_confirm',
        targetId: pairedHostId,
        requestId: pairedRequestId,
      }));
    }
    resetPairingJoin();
    clearPinError();
    setPinInputEnabled(true);
    setToken(pairedToken);
    showToast(`${pairedDeviceName} paired successfully`);
  } catch {
    pairingJoinFailed('Invalid PIN');
  }
}

async function joinWithPairingPin(tokenValue, pin) {
  pairingJoinToken = tokenValue;
  pairingJoinPakeSecret = null;
  pairingJoinPakeStart = null;
  setPinInputEnabled(false);
  closePairingJoinSocket();
  pairingJoinWs = new WebSocket(pairingSocketUrl(tokenValue));
  pairingJoinWs.onmessage = async event => {
    try { await handlePairingJoinMessage(JSON.parse(event.data)); } catch {}
  };
  pairingJoinWs.onopen = () => {};
  pairingJoinWs.onerror = () => pairingJoinFailed('Pairing failed');
  pairingJoinWs.onclose = () => {
    if (pairingJoinRequestId) pairingJoinFailed('Pairing disconnected');
  };
  clearPairingJoinTimer();
  pairingJoinTimer = setTimeout(() => pairingJoinFailed('Invalid PIN'), PAIRING_JOIN_TIMEOUT_MS);
}

async function answerPairingRequest(msg) {
  if (!pairingIsActive() || !currentPassphrase || pairingPinExpiresAt <= Date.now()) return;
  try {
    if (!msg.pakeStart || msg.pakeStart.version !== 'speke-v1' || msg.pakeStart.group !== 'rfc3526-2048') return;
    const aPublic = base64UrlToBigInt(msg.pakeStart.A);
    const secret = randomPakeScalar();
    const generator = await pakeGenerator(pairingPin, token, clientId, msg.requestId);
    const bPublic = modPow(generator, secret, PAKE_GROUP_P);
    const key = await derivePakeKey(
      pairingPin,
      token,
      clientId,
      msg.requestId,
      secret,
      aPublic,
      aPublic,
      bPublic
    );
    const bEncoded = bigIntToBase64Url(bPublic);
    const aad = `ClipShare PAKE response v1|${token}|${clientId}|${msg.requestId}|${msg.pakeStart.A}|${bEncoded}`;
    const encryptedPassphrase = await encryptPakeJson(key, {
      kind: 'clipshare-pairing-passphrase',
      requestId: msg.requestId,
      passphrase: currentPassphrase,
    }, aad);
    sendPairingJson({
      type: 'pairing_response',
      targetId: msg.senderId,
      requestId: msg.requestId,
      pakeFinish: {
        version: 'speke-v1',
        group: 'rfc3526-2048',
        B: bEncoded,
      },
      encryptedPassphrase,
    });
    pairingHostPendingRequests.set(msg.requestId, msg.senderId);
  } catch {}
}

function saveTokenInputsToStorage(tokenValue, passphraseValue) {
  localStorage.setItem('clipshare_token', normalizeToken(tokenValue));
  localStorage.setItem('clipshare_passphrase', passphraseValue || '');
}

function updateStartSharePreview() {
  const preparedToken = normalizeToken(document.getElementById('token-input').value);
  const preparedPassphrase = isGeneratedPasskey(currentPassphrase) ? currentPassphrase : '';
  const urlEl = document.getElementById('start-share-url');
  const qrEl = document.getElementById('start-qr-code');
  const section = document.getElementById('start-share-section');
  if (!urlEl || !qrEl) return;
  if (!preparedToken || !preparedPassphrase || !startPairingCreated) {
    urlEl.textContent = '';
    qrEl.innerHTML = '';
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';

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
  document.getElementById('token-input').value = '';
  document.getElementById('pin-input').value = '';
  currentPassphrase = '';
  updateStartSharePreview();
  updatePairingUi();
}

async function regenerateTokenInput(showMessage = true) {
  const newToken = generateToken();
  const newPassphrase = generatePassphrase();
  stopPairingMode({ all: true });
  token = normalizeToken(newToken);
  document.getElementById('token-input').value = formatToken(newToken);
  document.getElementById('pin-input').value = '';
  currentPassphrase = newPassphrase;
  saveTokenInputsToStorage(newToken, newPassphrase);
  await startPairingMode({ start: true });
  updateStartSharePreview();
  if (showMessage) showToast('Space created');
}

async function joinFromInput() {
  const t = normalizeToken(document.getElementById('token-input').value);
  const pin = (document.getElementById('pin-input')?.value || '').replace(/\D/g, '');
  if (!t) {
    showToast('Enter a token first');
    return;
  }
  if (pin.length === PAIRING_PIN_LENGTH) {
    await joinWithPairingPin(t, pin);
    return;
  }
  if (isGeneratedPasskey(currentPassphrase)) {
    saveTokenInputsToStorage(t, currentPassphrase);
    enterAppWithToken(t);
    return;
  }
  const hashPassphrase = passphraseFromHash();
  if (isGeneratedPasskey(hashPassphrase)) {
    currentPassphrase = hashPassphrase;
    saveTokenInputsToStorage(t, currentPassphrase);
    enterAppWithToken(t);
    return;
  }
  showToast('Enter an 8 digit PIN or use a full share URL');
}

function enterAppWithToken(t) {
  stopPairingMode({ all: true });
  setToken(t);
}

function setToken(t) {
  token = normalizeToken(t);
  if (!token) return;
  localStorage.setItem('clipshare_token', token);
  history.replaceState({}, '', `/${encodeURIComponent(token)}`);
  document.body.classList.add('app-active');
  document.getElementById('token-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('header-token').textContent = token;
  updateEmpty();
  loadChatMessages();
  updateChatUnreadBadge();
  connectWS();
}

function leaveSpace() {
  stopPairingMode({ all: true });
  resetPairingJoin();
  closeAllWebRtcPeers();
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  if (dataWs) { dataWs.onclose = null; dataWs.close(); dataWs = null; }
  if (wsRetryTimer) { clearTimeout(wsRetryTimer); wsRetryTimer = null; }
  if (dataWsRetryTimer) { clearTimeout(dataWsRetryTimer); dataWsRetryTimer = null; }
  stopMetricsPing();
  releaseSendWakeLock();
  const chatKey = chatStorageKey();
  token = null;
  items.clear();
  if (chatKey) localStorage.removeItem(chatKey);
  chatMessages.length = 0;
  unreadChatCount = 0;
  updateChatUnreadBadge();
  renderChatMessages();
  toggleChatPanel(false);
  cardEncryptionKeys.clear();
  peerCardMetadata.clear();
  roomManifest.clear();
  manifestRevisions.clear();
  binaryTransfers.clear();
  clearAllOutboundRetries();
  outboundTransfers.clear();
  remoteTransferStatuses.clear();
  transferStatusPublishTimes.clear();
  for (const timer of downloadSourceRetryTimers.values()) clearTimeout(timer);
  downloadSourceRetryTimers.clear();
  downloadSourceRetryAttempts.clear();
  pendingDownloadSourceIds.clear();
  pendingDownloadTriedSources.clear();
  pendingChunkRequestBatches.clear();
  downloadLogSources.clear();
  pendingInitialSyncSources = null;
  editTimers.forEach(clearTimeout);
  editTimers.clear();
  clientCount = 0;
  updatePeerCount();
  document.getElementById('cards').innerHTML = '';
  document.body.classList.remove('app-active');
  document.getElementById('app').style.display = 'none';
  document.getElementById('token-screen').style.display = 'flex';
  loadTokenInputsFromStorage();
  history.replaceState({}, '', '/');
  setDot('disconnected');
  updateEmpty();
}

function openClearModal() {
  if (!items.size && !chatMessages.length) return;
  const modal = document.getElementById('clear-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeClearModal() {
  const modal = document.getElementById('clear-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openChatArchiveModal() {
  if (!chatMessages.length) return;
  const modal = document.getElementById('chat-archive-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeChatArchiveModal() {
  const modal = document.getElementById('chat-archive-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openChatClearModal() {
  if (!chatMessages.length) return;
  const modal = document.getElementById('chat-clear-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeChatClearModal() {
  const modal = document.getElementById('chat-clear-modal');
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

function nextManifestRevision(itemId) {
  const revision = Math.max(Date.now(), (manifestRevisions.get(itemId) || 0) + 1);
  manifestRevisions.set(itemId, revision);
  return revision;
}

async function encryptedManifestMeta(item) {
  if (!encryptionKey) return null;
  const meta = cardMetadataFromItem(item);
  if (!meta) return null;
  return await encryptMessage(JSON.stringify(meta), encryptionKey);
}

function debugLog(event, details = {}) {
  console.log(event, {
    clientId: clientId.slice(0, 8),
    token,
    ...details,
  });
}

function downloadLogFileLabel(itemId) {
  return transferItemTitle(itemId) || String(itemId || 'file');
}

function downloadLogSourceLabel(sourceId) {
  return buildPeerIdentityMap().get(sourceId)?.fullName || (sourceId ? `Peer ${String(sourceId).slice(0, 8)}` : 'Unknown source');
}

function uploadLogTargetLabel(targetId) {
  return targetId ? downloadLogSourceLabel(targetId) : 'Broadcast';
}

function transferLogPrefix(base, transport = '') {
  return `${base}${transport === 'webrtc' ? '+' : ''}`;
}

function logDownloadSourceStart(itemId, sourceId, totalChunks, transport = '') {
  if (!itemId || !sourceId) return;
  if (!downloadLogSources.has(itemId)) downloadLogSources.set(itemId, new Set());
  const sources = downloadLogSources.get(itemId);
  if (sources.has(sourceId)) return;
  sources.add(sourceId);
  console.log(`${transferLogPrefix('DN', transport)} ${downloadLogFileLabel(itemId)} chunks ${downloadLogSourceLabel(sourceId)} start`, {
    chunks: totalChunks || 0,
  });
}

function logDownloadChunk(itemId, chunkIndex, totalChunks, sourceId, transport = '') {
  if (!itemId || !sourceId || !Number.isFinite(chunkIndex)) return;
  console.log(`${transferLogPrefix('DN', transport)} ${downloadLogFileLabel(itemId)} chunk ${chunkIndex + 1}/${totalChunks || '?'} ${downloadLogSourceLabel(sourceId)}`);
}

function logDownloadDone(itemId, sourceIds = [], transport = '') {
  const names = [...new Set(sourceIds.filter(Boolean).map(downloadLogSourceLabel))];
  console.log(`${transferLogPrefix('DN', transport)} ${downloadLogFileLabel(itemId)} chunks ${names.join(' + ') || 'Unknown source'} done`);
  downloadLogSources.delete(itemId);
}

function logUploadStart(itemId, targetId, totalChunks, transport = '') {
  console.log(`${transferLogPrefix('UP', transport)} ${downloadLogFileLabel(itemId)} chunks ${uploadLogTargetLabel(targetId)} start`, {
    chunks: totalChunks || 0,
  });
}

function logUploadChunk(itemId, chunkIndex, totalChunks, targetId, transport = '') {
  if (!itemId || !Number.isFinite(chunkIndex)) return;
  console.log(`${transferLogPrefix('UP', transport)} ${downloadLogFileLabel(itemId)} chunk ${chunkIndex + 1}/${totalChunks || '?'} ${uploadLogTargetLabel(targetId)}`);
}

function logUploadDone(itemId, targetId, transport = '') {
  console.log(`${transferLogPrefix('UP', transport)} ${downloadLogFileLabel(itemId)} chunks ${uploadLogTargetLabel(targetId)} done`);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isValidChunkIndex(index, totalChunks) {
  return Number.isInteger(index) && index >= 0 && index < totalChunks;
}

function isValidChunkSet(chunkIndex, totalChunks) {
  return Number.isInteger(totalChunks)
    && totalChunks > 0
    && totalChunks <= MAX_TRANSFER_CHUNKS
    && isValidChunkIndex(chunkIndex, totalChunks);
}

function normalizeChunkIndexes(indexes, totalChunks) {
  if (!Array.isArray(indexes) || !Number.isFinite(totalChunks)) return null;
  const unique = [...new Set(indexes.map(Number).filter(index => isValidChunkIndex(index, totalChunks)))];
  unique.sort((a, b) => a - b);
  return unique;
}

function detectDeviceType() {
  const ua = navigator.userAgent || '';
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const narrowViewport = Math.min(window.innerWidth || 0, window.innerHeight || 0) < 820;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarsePointer && narrowViewport) ? 'mobile' : 'desktop';
}

function normalizeClientMetrics(metrics = {}) {
  return {
    deviceType: metrics.deviceType === 'mobile' ? 'mobile' : 'desktop',
    pingMs: Number.isFinite(Number(metrics.pingMs)) ? Number(metrics.pingMs) : null,
    uploadBps: Number.isFinite(Number(metrics.uploadBps)) ? Number(metrics.uploadBps) : null,
    downloadBps: Number.isFinite(Number(metrics.downloadBps)) ? Number(metrics.downloadBps) : null,
    updatedAt: Number(metrics.updatedAt) || Date.now(),
  };
}

function publishClientMetrics() {
  selfClientMetrics.deviceType = detectDeviceType();
  selfClientMetrics.updatedAt = Date.now();
  return false;
}

function recordTransferMetric(kind, bytes, startTime) {
  const elapsedSeconds = Math.max((Date.now() - startTime) / 1000, 0.001);
  const bps = Math.round((Number(bytes) || 0) / elapsedSeconds);
  if (!Number.isFinite(bps) || bps <= 0) return;
  if (kind === 'upload') selfClientMetrics.uploadBps = bps;
  if (kind === 'download') selfClientMetrics.downloadBps = bps;
  publishClientMetrics();
}

function startMetricsPing() {
  stopMetricsPing();
  sendMetricsPing();
  metricsPingTimer = setInterval(sendMetricsPing, METRICS_PING_INTERVAL_MS);
}

function stopMetricsPing() {
  if (metricsPingTimer) {
    clearInterval(metricsPingTimer);
    metricsPingTimer = null;
  }
}

function sendMetricsPing() {
  return false;
}

function formatSpeed(bytesPerSecond) {
  const bps = Number(bytesPerSecond);
  if (!Number.isFinite(bps) || bps <= 0) return '...';
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

function formatPing(ms) {
  const value = Number(ms);
  return Number.isFinite(value) && value >= 0 ? `${Math.round(value)} ms` : '...';
}

function metricsDetail(metrics) {
  const m = normalizeClientMetrics(metrics);
  return `${m.deviceType === 'mobile' ? 'Mobile' : 'Desktop'} | Ping ${formatPing(m.pingMs)} | Up ${formatSpeed(m.uploadBps)} | Down ${formatSpeed(m.downloadBps)}`;
}

async function publishClientCardMetadata(item) {
  const meta = cardMetadataFromItem(item);
  if (!meta || !ws || ws.readyState !== WebSocket.OPEN) return;
  debugLog('announce', { itemId: item.id, type: item.type, filename: item.filename, size: item.size, encrypted: !!item.encrypted });
  const encryptedMeta = await encryptedManifestMeta(item);
  if (!encryptedMeta) return;
  const revision = nextManifestRevision(item.id);
  sendPriorityJson({
    type: 'manifest_upsert',
    itemId: item.id,
    revision,
    updatedAt: Date.now(),
    encryptedMeta,
  });
}

function publishClientCardRemoval(itemId, reason = 'delete') {
  if (!itemId || !ws || ws.readyState !== WebSocket.OPEN) return;
  debugLog('announce-remove', { itemId, reason });
  sendPriorityJson({
    type: 'manifest_delete',
    itemId,
    revision: nextManifestRevision(itemId),
    updatedAt: Date.now(),
  });
}

function canPublishCardHolder(item) {
  return !!item && item.type !== 'encrypted' && (item.type === 'text' || !!item.rawBuffer);
}

function publishLocalManifest() {
  for (const item of items.values()) {
    if (!canPublishCardHolder(item)) continue;
    publishClientCardMetadata(item);
  }
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

function rebuildPeerCardMetadataFromManifest() {
  peerCardMetadata.clear();
  for (const record of roomManifest.values()) {
    const meta = record?.meta;
    if (!meta?.id) continue;
    for (const holderId of record.holders || []) {
      if (holderId !== clientId && connectedPeers.has(holderId)) rememberPeerCardMetadata(holderId, meta);
    }
  }
}

function rememberManifestMeta(ownerId, meta, revision = 0, holders = null) {
  if (!ownerId || !meta?.id) return;
  const existing = roomManifest.get(meta.id);
  if (existing && (existing.revision || 0) > revision) return;
  const holderIds = [...new Set((holders?.length ? holders : [ownerId]).filter(Boolean))];
  roomManifest.set(meta.id, { ownerId, holders: holderIds, revision, meta });
  manifestRevisions.set(meta.id, Math.max(manifestRevisions.get(meta.id) || 0, revision || 0));
  rebuildPeerCardMetadataFromManifest();
}

function removeManifestMeta(itemId, revision = 0) {
  if (!itemId) return;
  const existing = roomManifest.get(itemId);
  if (existing && (existing.revision || 0) > revision) return;
  roomManifest.delete(itemId);
  manifestRevisions.set(itemId, Math.max(manifestRevisions.get(itemId) || 0, revision || 0));
  rebuildPeerCardMetadataFromManifest();
}

async function applyManifestRecord(record) {
  if (!record?.itemId) return;
  const revision = Number(record.revision) || 0;
  if (record.deleted) {
    removeManifestMeta(record.itemId, revision);
    return;
  }
  if (!record.encryptedMeta || !encryptionKey) return;
  try {
    const meta = JSON.parse(await decryptMessage(record.encryptedMeta, encryptionKey));
    if (meta?.id !== record.itemId) return;
    rememberManifestMeta(record.ownerId, meta, revision, record.holders);
  } catch {
    // A manifest from a different passkey stays invisible.
  }
}

async function applyManifestSnapshot(records = []) {
  for (const record of records || []) await applyManifestRecord(record);
  if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
  armRecoveryTimersForIncompleteReceives();
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
      if (!meta?.filename && !meta?.mimeType && meta?.type === 'unknown') return;
      if (meta) cards.set(meta.id, meta);
    });
    if (cards.size) peerCardMetadata.set(source.clientId, cards);
  }
}

function hasConnectedCompleteSource(itemId) {
  if (!itemId) return false;
  for (const [peerId, cards] of peerCardMetadata) {
    if (connectedPeers.get(peerId)?.compatibility === 'compatible' && cards?.has(itemId)) return true;
  }
  return false;
}

function isIncompleteIncomingCard(itemId) {
  const item = items.get(itemId);
  return !!itemId && (
    binaryTransfers.has(itemId) ||
    expectsIncomingChunks(item)
  );
}

function cancelInterruptedIncomingCard(itemId) {
  if (!isIncompleteIncomingCard(itemId)) return false;
  items.delete(itemId);
  cardEncryptionKeys.delete(itemId);
  binaryTransfers.delete(itemId);
  chunkScheduler.cancelItem(itemId);
  clearOutboundRetriesForItem(itemId);
  outboundTransfers.delete(itemId);
  clearAutomaticDownloadRetry(itemId);
  downloadSourceRetryAttempts.delete(itemId);
  pendingDownloadSourceIds.delete(itemId);
  pendingDownloadTriedSources.delete(itemId);
  pendingChunkRequestBatches.delete(itemId);
  downloadLogSources.delete(itemId);
  clearTransferStatusesForItem(itemId);
  removeCardAnimated(itemId, updateEmpty);
  updateSendWakeLock();
  return true;
}

function removeOrphanedIncomingCards() {
  const candidateIds = new Set([
    ...binaryTransfers.keys(),
    ...[...items.values()].filter(item => expectsIncomingChunks(item)).map(item => item.id),
  ]);
  let removed = 0;
  for (const itemId of candidateIds) {
    if (!hasConnectedCompleteSource(itemId) && cancelInterruptedIncomingCard(itemId)) removed++;
  }
  if (removed) {
    showToast(removed === 1 ? 'Transfer interrupted.' : 'Transfers interrupted.');
    schedulePeersModalRefresh();
  }
}

function peerCardTitle(meta) {
  if (meta.filename) return meta.filename;
  if (meta.mimeType) return fileTypeName(meta.mimeType);
  if (meta.type === 'text') return 'Text note';
  if (meta.type === 'image') return 'Shared image';
  if (meta.type === 'file') return 'Shared file';
  return 'Shared card';
}

function peerCardDetail(meta) {
  if (!meta.size) return '';
  const parts = [];
  parts.push(humanSize(meta.size));
  if (meta.addedAt) parts.push(timeAgo(meta.addedAt));
  return parts.join(' | ');
}

function transferItemTitle(itemId) {
  const item = items.get(itemId);
  if (item) return peerCardTitle(cardMetadataFromItem(item) || item);
  for (const cards of peerCardMetadata.values()) {
    const meta = cards?.get(itemId);
    if (meta) return peerCardTitle(meta);
  }
  return 'File';
}

function transferStatusKey(status) {
  return `${status.itemId || ''}:${status.sourceId || ''}:${status.targetId || ''}`;
}

function clearRemoteTransferStatusesForPeer(peerId) {
  for (const [key, status] of remoteTransferStatuses) {
    if (status.sourceId === peerId || status.targetId === peerId) remoteTransferStatuses.delete(key);
  }
}

function clearTransferStatusesForItem(itemId) {
  for (const key of remoteTransferStatuses.keys()) {
    if (key.startsWith(`${itemId}:`)) remoteTransferStatuses.delete(key);
  }
  for (const key of transferStatusPublishTimes.keys()) {
    if (key.startsWith(`${itemId}:`)) transferStatusPublishTimes.delete(key);
  }
}

function publishTransferStatus({ itemId, sourceId, targetId, current, done, total, chunkRuns = null, transport = '', status = 'active', force = false }) {
  if (!itemId || !sourceId || !targetId || !ws || ws.readyState !== WebSocket.OPEN) return;
  const key = `${itemId}:${sourceId}:${targetId}`;
  const now = Date.now();
  if (!force && now - (transferStatusPublishTimes.get(key) || 0) < 350) return;
  transferStatusPublishTimes.set(key, now);
  wsSend({
    type: 'relay',
    payload: {
      type: 'transfer_status',
      itemId,
      sourceId,
      targetId,
      title: transferItemTitle(itemId),
      currentChunk: Math.max(0, Number(current) || 0),
      receivedChunks: Math.max(0, Number(done) || 0),
      totalChunks: Math.max(0, Number(total) || 0),
      chunkRuns: normalizeTransferChunkRuns(chunkRuns),
      transport: transport === 'webrtc' ? 'webrtc' : '',
      status,
      updatedAt: now,
    },
  }, null, true);
}

function applyRemoteTransferStatus(status) {
  if (!status?.itemId || !status.sourceId || !status.targetId) return;
  if (status.sourceId === clientId || status.targetId === clientId) return;
  const normalized = {
    itemId: String(status.itemId),
    sourceId: String(status.sourceId),
    targetId: String(status.targetId),
    title: String(status.title || transferItemTitle(status.itemId)).slice(0, 160),
    currentChunk: Math.max(0, Number(status.currentChunk) || 0),
    receivedChunks: Math.max(0, Number(status.receivedChunks) || 0),
    totalChunks: Math.max(0, Number(status.totalChunks) || 0),
    chunkRuns: normalizeTransferChunkRuns(status.chunkRuns),
    transport: status.transport === 'webrtc' ? 'webrtc' : '',
    status: status.status === 'done' ? 'done' : 'active',
    updatedAt: Number(status.updatedAt) || Date.now(),
  };
  const key = transferStatusKey(normalized);
  const previous = remoteTransferStatuses.get(key);
  if (previous?.status === 'done' && normalized.status !== 'done' && normalized.updatedAt <= previous.updatedAt) return;
  if (!normalized.chunkRuns.length && previous?.chunkRuns?.length) normalized.chunkRuns = previous.chunkRuns;
  if (normalized.status === 'done') {
    remoteTransferStatuses.set(key, normalized);
    setTimeout(() => {
      const current = remoteTransferStatuses.get(key);
      if (current?.updatedAt === normalized.updatedAt) {
        remoteTransferStatuses.delete(key);
        schedulePeersModalRefresh();
      }
    }, 900);
  } else {
    remoteTransferStatuses.set(key, normalized);
  }
  schedulePeersModalRefresh();
}

function normalizeTransferChunkRuns(runs) {
  if (!Array.isArray(runs)) return [];
  return runs
    .map(run => ({
      sourceId: run?.sourceId ? String(run.sourceId) : '',
      count: Math.max(0, Math.floor(Number(run?.count) || 0)),
    }))
    .filter(run => run.count > 0);
}

function transferChunkRunsFromSources(sourceIds, totalChunks) {
  const total = Math.max(0, Math.floor(Number(totalChunks) || 0));
  if (!total) return [];
  const runs = [];
  let currentSourceId = '';
  let count = 0;
  for (let i = 0; i < total; i++) {
    const nextSourceId = sourceIds?.[i] ? String(sourceIds[i]) : '';
    if (i === 0 || nextSourceId === currentSourceId) {
      currentSourceId = nextSourceId;
      count++;
      continue;
    }
    runs.push({ sourceId: currentSourceId, count });
    currentSourceId = nextSourceId;
    count = 1;
  }
  if (count) runs.push({ sourceId: currentSourceId, count });
  return runs;
}

function transferChunkRunsFromAcked(progress, sourceId) {
  const total = Math.max(0, Math.floor(Number(progress?.total) || 0));
  if (!total) return [];
  const sources = new Array(total).fill('');
  for (const index of progress?.ackedChunks || []) {
    if (Number.isInteger(index) && index >= 0 && index < total) sources[index] = sourceId || '';
  }
  return transferChunkRunsFromSources(sources, total);
}

function transferStatusRowsForPeer(peerId) {
  const rows = [];
  const imap = buildPeerIdentityMap();
  for (const [itemId, transfer] of binaryTransfers) {
    if (peerId !== clientId) continue;
    rows.push({
      itemId,
      direction: 'DN',
      sourceId: transfer.senderId || '',
      sourceIds: transferSourceIdsFromChunks(transfer.chunkSources, transfer.senderId),
      source: imap.get(transfer.senderId)?.fullName || 'Peer',
      title: transferItemTitle(itemId),
      current: transfer.currentChunk || transfer.received || 0,
      done: transfer.received || 0,
      total: transfer.totalChunks || 0,
      chunkRuns: transferChunkRunsFromSources(transfer.chunkSources, transfer.totalChunks),
      transport: transfer.transport || '',
    });
  }
  for (const [itemId, peerMap] of outboundTransfers) {
    const progress = peerMap.get(peerId);
    if (!progress) continue;
    rows.push({
      itemId,
      direction: 'UP',
      sourceId: clientId,
      sourceIds: [clientId],
      source: 'You',
      title: transferItemTitle(itemId),
      current: progress.currentChunk || progress.sent || 0,
      done: progress.sent || 0,
      total: progress.total || 0,
      chunkRuns: transferChunkRunsFromAcked(progress, clientId),
      transport: progress.transport || '',
    });
  }
  for (const status of remoteTransferStatuses.values()) {
    if (status.targetId !== peerId) continue;
    rows.push({
      itemId: status.itemId,
      direction: 'DN',
      sourceId: status.sourceId,
      sourceIds: [status.sourceId],
      source: imap.get(status.sourceId)?.fullName || 'Peer',
      title: status.title || transferItemTitle(status.itemId),
      current: status.currentChunk || status.receivedChunks || 0,
      done: status.receivedChunks || 0,
      total: status.totalChunks || 0,
      chunkRuns: status.chunkRuns || [],
      transport: status.transport || '',
    });
  }
  return mergeTransferStatusRows(rows);
}

function mergeTransferStatusRows(rows) {
  const merged = new Map();
  for (const row of rows) {
    const key = row.itemId || `${row.title}:${row.total}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row, sourceNames: new Set([row.source].filter(Boolean)), sourceIds: new Set(row.sourceIds || [row.sourceId].filter(Boolean)) });
      continue;
    }
    if (row.source) existing.sourceNames.add(row.source);
    for (const sourceId of row.sourceIds || [row.sourceId].filter(Boolean)) existing.sourceIds.add(sourceId);
    existing.current = Math.max(existing.current || 0, row.current || 0);
    existing.done = Math.max(existing.done || 0, row.done || 0);
    existing.total = Math.max(existing.total || 0, row.total || 0);
    if (row.transport === 'webrtc') existing.transport = 'webrtc';
    if ((row.chunkRuns?.length || 0) > (existing.chunkRuns?.length || 0)) existing.chunkRuns = row.chunkRuns;
  }
  return [...merged.values()].map(row => ({
    ...row,
    sourceIds: [...row.sourceIds],
    source: [...row.sourceNames].join(' + ') || row.source || 'Peer',
  }));
}

function renderTransferStatus(rows) {
  if (!rows.length) return '';
  return `<div class="peer-transfer-list">${rows.map(row => {
    const pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
    const chunk = row.total ? `${Math.min(row.current, row.total)}/${row.total}` : '...';
    const chunkBar = renderTransferChunkBar(row);
    const direction = `${row.direction || 'DN'}${row.transport === 'webrtc' ? '+' : ''}`;
    return `<div class="peer-transfer-row">
      <div class="peer-transfer-meta">
        <span class="peer-transfer-title" title="${escAttr(row.title)}">${escHtml(direction)}: ${escHtml(row.title)}</span>
        <span class="peer-transfer-source"><span>Source</span>${peerIconStackHtml(row.sourceIds, 'peer-transfer-source-icons')}<span>| Chunk ${escHtml(chunk)} | ${pct}%</span></span>
      </div>
      ${chunkBar}
    </div>`;
  }).join('')}</div>`;
}

function renderTransferChunkBar(row) {
  const total = Math.max(0, Math.floor(Number(row.total) || 0));
  const runs = normalizeTransferChunkRuns(row.chunkRuns);
  if (!total || !runs.length) {
    const pct = total ? Math.round((row.done / total) * 100) : 0;
    return `<div class="peer-transfer-progress"><div class="peer-transfer-fill" style="width:${pct}%"></div></div>`;
  }
  const imap = buildPeerIdentityMap();
  const chunks = [];
  const densityClass = total > 120 ? ' peer-transfer-chunks-dense' : '';
  for (const run of runs) {
    const identity = run.sourceId ? imap.get(run.sourceId) : null;
    const color = identity?.iconColor || 'transparent';
    const filledClass = run.sourceId ? ' peer-transfer-chunk-done' : '';
    for (let i = 0; i < run.count; i++) {
      chunks.push(`<span class="peer-transfer-chunk${filledClass}" style="--peer-transfer-chunk:${escAttr(color)}"></span>`);
    }
  }
  return `<div class="peer-transfer-progress peer-transfer-chunks${densityClass}" style="--peer-transfer-total:${total}">${chunks.join('')}</div>`;
}

function schedulePeersModalRefresh() {
  const peersModal = document.getElementById('peers-modal');
  const detailModal = document.getElementById('peer-detail-modal');
  const shouldRefreshPeers = peersModal?.classList.contains('open');
  const shouldRefreshDetail = detailModal?.classList.contains('open') && openPeerDetailId;
  if ((!shouldRefreshPeers && !shouldRefreshDetail) || peersModalRefreshTimer) return;
  peersModalRefreshTimer = setTimeout(() => {
    peersModalRefreshTimer = null;
    if (peersModal?.classList.contains('open')) openPeersModal();
    if (detailModal?.classList.contains('open') && openPeerDetailId) openPeerDetailModal(openPeerDetailId);
  }, 250);
}

function renderPeerCardMetadata(cards) {
  const metas = [...(cards || new Map()).values()].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  if (!metas.length) return '<div class="peer-card-empty">No cards</div>';
  return `<div class="peer-card-list">${metas.map(meta => {
    const title = peerCardTitle(meta);
    const detail = peerCardDetail(meta);
    return `
    <div class="peer-card-meta">
      <span class="peer-card-name" title="${escAttr(title)}">${escHtml(title)}</span>
      ${detail ? `<span class="peer-card-detail">${escHtml(detail)}</span>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function peerStatusDetail(id, peer) {
  if (id === clientId) return '';
  const metrics = normalizeClientMetrics(peer?.metrics || {});
  const icon = metrics.deviceType === 'mobile' ? 'smartphone' : 'monitor';
  const ip = peer?.ip || 'IP unknown';
  const rtc = webRtcPeerState(id) === 'connected' ? '<span>WebRTC</span>' : '';
  return `${rtc}<span class="peer-row-device"><span>${escHtml(ip)}</span><i data-lucide="${icon}"></i></span>`;
}

function formatDetailTime(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return '...';
  return `${new Date(value).toLocaleString()} (${timeAgo(value)})`;
}

function wsStateLabel(socket) {
  if (!socket) return 'closed';
  if (socket.readyState === WebSocket.CONNECTING) return 'connecting';
  if (socket.readyState === WebSocket.OPEN) return 'open';
  if (socket.readyState === WebSocket.CLOSING) return 'closing';
  return 'closed';
}

function detailRowsHtml(rows) {
  return rows
    .filter(row => row && row[0] && row[1] !== '')
    .map(([label, value]) => `<div class="peer-detail-row"><span>${escHtml(label)}</span><strong>${escHtml(value ?? '')}</strong></div>`)
    .join('');
}

function peerDetailSnapshot(peerId) {
  const isSelf = peerId === clientId;
  const imap = buildPeerIdentityMap();
  const identity = imap.get(peerId) || fallbackPeerIdentity(peerId);
  const peer = isSelf ? { ...selfPeerInfo, metrics: selfClientMetrics, compatibility: 'self' } : connectedPeers.get(peerId);
  const metrics = normalizeClientMetrics(peer?.metrics || {});
  const rtc = webRtcPeers.get(peerId);
  const cards = isSelf
    ? new Map([...items.values()].map(item => [item.id, cardMetadataFromItem(item)]).filter(([, meta]) => meta))
    : (peerCardMetadata.get(peerId) || new Map());
  const transferRows = transferStatusRowsForPeer(peerId);
  return {
    peerId,
    isSelf,
    identity,
    peer,
    metrics,
    rtc,
    cards,
    transferRows,
  };
}

function openPeerDetailModal(peerId) {
  const modal = document.getElementById('peer-detail-modal');
  const body = document.getElementById('peer-detail-body');
  const title = document.getElementById('peer-detail-title');
  if (!modal || !body || !title || !peerId) return;
  const snap = peerDetailSnapshot(peerId);
  const { identity, peer, metrics, rtc, cards, transferRows } = snap;
  if (!peer && !snap.isSelf) return;
  openPeerDetailId = peerId;
  title.textContent = identity.fullName + (snap.isSelf ? ' (You)' : '');
  const rtcState = webRtcPeerState(peerId);
  const rtcRows = [
    ['Status', webRtcStateLabel(peerId)],
    ['Unavailable reason', rtcState === 'unavailable' ? webRtcUnavailableReason(peerId) : ''],
    ['Start blocked reason', webRtcStartBlockReason(peerId)],
    ['Start attempts', rtc ? String(rtc.startAttempts || 0) : '0'],
    ['Last start attempt', rtc?.lastStartAttemptAt ? formatDetailTime(rtc.lastStartAttemptAt) : '...'],
    ['Last start error', rtc?.error || ''],
    ['Supported by browser', isWebRtcSupported() ? 'yes' : 'no'],
    ['Initiator', rtc ? (rtc.initiator ? 'yes' : 'no') : '...'],
    ['PeerConnection state', rtc?.connectionState || rtc?.pc?.connectionState || '...'],
    ['ICE connection state', rtc?.iceConnectionState || rtc?.pc?.iceConnectionState || '...'],
    ['ICE gathering state', rtc?.iceGatheringState || rtc?.pc?.iceGatheringState || '...'],
    ['Signaling state', rtc?.signalingState || rtc?.pc?.signalingState || '...'],
    ['Data channel state', rtc?.channelState || rtc?.channel?.readyState || '...'],
    ['Pending ICE candidates', String(rtc?.pendingCandidates?.length || 0)],
    ['ICE sent / received', rtc ? `${rtc.iceCandidatesSent || 0} / ${rtc.iceCandidatesReceived || 0}` : '0 / 0'],
    ['Local / remote SDP', rtc ? `${rtc.localDescriptionType || '...'} / ${rtc.remoteDescriptionType || '...'}` : '... / ...'],
    ['Last signal sent', rtc?.lastSignalSentType ? `${rtc.lastSignalSentType} - ${formatDetailTime(rtc.lastSignalSentAt)}` : '...'],
    ['Last signal received', rtc?.lastSignalReceivedType ? `${rtc.lastSignalReceivedType} - ${formatDetailTime(rtc.lastSignalReceivedAt)}` : '...'],
    ['Last heartbeat pong', peer?.webrtcLastPongAt ? formatDetailTime(peer.webrtcLastPongAt) : '...'],
    ['Created', rtc?.createdAt ? formatDetailTime(rtc.createdAt) : '...'],
    ['Updated', rtc?.updatedAt ? formatDetailTime(rtc.updatedAt) : '...'],
  ];
  const generalRows = [
    ['Full ID', peerId],
    ['Short ID', peerId.slice(0, 8)],
    ['Peer number', peer?.label || selfPeerInfo.label || '...'],
    ['IP', peer?.ip || 'unknown'],
    ['Device', metrics.deviceType === 'mobile' ? 'Mobile' : 'Desktop'],
    ['Compatibility', peerCompatibilityDetail(peer, snap.isSelf)],
    ['Cards known', String(cards.size || 0)],
    ['Transfer rows', String(transferRows.length || 0)],
  ];
  const metricRows = [
    ['Relay ping', formatPing(metrics.pingMs)],
    ['Upload speed', formatSpeed(metrics.uploadBps)],
    ['Download speed', formatSpeed(metrics.downloadBps)],
    ['Metrics updated', formatDetailTime(metrics.updatedAt)],
  ];
  const localRows = snap.isSelf ? [
    ['Token', token || '...'],
    ['Control WebSocket', wsStateLabel(ws)],
    ['Data WebSocket', wsStateLabel(dataWs)],
    ['Encryption enabled', encryptionEnabled ? 'yes' : 'no'],
    ['ICE servers configured', String(webRtcConfig?.iceServers?.length || 0)],
  ] : [];
  body.innerHTML = `
    <div class="peer-detail-identity">${peerPillHtml(identity, 'peer-pill-sm')}<span>${escHtml(identity.fullName)}${snap.isSelf ? ' (You)' : ''}</span></div>
    <div class="peer-detail-section"><h3>General</h3>${detailRowsHtml(generalRows)}</div>
    <div class="peer-detail-section"><h3>WebRTC</h3>${detailRowsHtml(rtcRows)}</div>
    <div class="peer-detail-section"><h3>Network</h3>${detailRowsHtml(metricRows)}</div>
    ${localRows.length ? `<div class="peer-detail-section"><h3>This Device</h3>${detailRowsHtml(localRows)}</div>` : ''}
    <div class="peer-detail-section"><h3>Transfers</h3>${transferRows.length ? renderTransferStatus(transferRows) : '<div class="peer-card-empty">No active transfers</div>'}</div>
    <div class="peer-detail-section"><h3>Known Cards</h3>${renderPeerCardMetadata(cards)}</div>
  `;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  refreshIcons();
}

function closePeerDetailModal() {
  const modal = document.getElementById('peer-detail-modal');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  openPeerDetailId = null;
}

function openPeersModal() {
  const list = document.getElementById('peers-list');
  list.innerHTML = '';
  const imap = buildPeerIdentityMap();
  const selfId = imap.get(clientId);
  const rows = [
    { id: clientId, identity: selfId, label: `${selfId.fullName} (You)`, detail: peerStatusDetail(clientId, { ...selfPeerInfo, metrics: selfClientMetrics }), cards: new Map([...items.values()].map(item => [item.id, cardMetadataFromItem(item)]).filter(([, meta]) => meta)) },
    ...[...connectedPeers.entries()].map(([id, peer]) => {
      const pid = imap.get(id);
      const compatible = peer.compatibility === 'compatible';
      return { id, identity: pid, label: pid.fullName, detail: peerStatusDetail(id, peer), cards: compatible ? (peerCardMetadata.get(id) || new Map()) : new Map(), compatibility: peer.compatibility };
    })
  ];

  for (const row of rows) {
    const el = document.createElement('div');
    el.className = `peer-row peer-user-row${row.compatibility === 'incompatible' ? ' peer-incompatible' : ''}`;
    const detailHtml = row.detail ? `<span class="spacer"></span><span class="token-modal-label peer-row-detail">${row.detail}</span>` : '';
    el.innerHTML = `<div class="peer-row-main"><button class="peer-detail-trigger" type="button" data-peer-id="${escAttr(row.id)}" title="Show details">${peerPillHtml(row.identity, 'peer-pill-sm')}<span class="peer-row-name">${escHtml(row.label)}</span></button>${detailHtml}</div>${renderTransferStatus(transferStatusRowsForPeer(row.id))}${renderPeerCardMetadata(row.cards)}`;
    el.querySelector('.peer-detail-trigger')?.addEventListener('click', () => openPeerDetailModal(row.id));
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

function runPendingInitialSyncIfReady() {
  if (!pendingInitialSyncSources?.length || !dataWs || dataWs.readyState !== WebSocket.OPEN) return;
  const sources = pendingInitialSyncSources;
  pendingInitialSyncSources = null;
  autoSelectSyncSource(sources);
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
}

function requestSyncFrom(sourceClientId, itemId = null, missingChunks = null, { silent = false } = {}) {
  if (!sourceClientId) return;
  const requestedChunks = missingChunks?.length ? missingChunks.slice(0, CHUNK_REQUEST_MAX_CHUNKS) : null;
  if (itemId && requestedChunks?.length) {
    pendingChunkRequestBatches.set(itemId, {
      sourceClientId,
      chunks: new Set(requestedChunks),
    });
  }
  debugLog('retrieve-request', {
    sourceClientId,
    itemId,
    missingChunks: requestedChunks?.length,
    remainingMissingChunks: missingChunks?.length ? Math.max(0, missingChunks.length - requestedChunks.length) : 0,
  });
  wsSend({
    type: 'relay',
    targetId: sourceClientId,
    payload: {
      type: 'sync_request',
      requesterId: clientId,
      itemId: itemId || undefined,
      missingChunks: requestedChunks?.length ? requestedChunks : undefined,
    },
  }, null, true);
  if (!silent) showToast(itemId ? 'Retrying download...' : 'Requesting files...');
}

function continueChunkRequestBatch(itemId, chunkIndex, senderId = null) {
  const batch = pendingChunkRequestBatches.get(itemId);
  if (!batch || (senderId && batch.sourceClientId && batch.sourceClientId !== senderId)) return;
  batch.chunks.delete(Number(chunkIndex));
  if (batch.chunks.size) return;
  pendingChunkRequestBatches.delete(itemId);
  const transfer = binaryTransfers.get(itemId);
  const encryptedChunks = items.get(encryptedPlaceholderIdForItem(itemId))?.encryptedBinaryChunks;
  const transferDone = transfer && transfer.received >= transfer.totalChunks;
  if (transferDone) return;
  const missingChunks = transfer
    ? missingTransferChunks(transfer)
    : missingStoredEncryptedChunks(encryptedChunks);
  if (missingChunks?.length) {
    requestSyncFrom(senderId || batch.sourceClientId, itemId, missingChunks, { silent: true });
  }
}

function missingTransferChunks(transfer) {
  if (!transfer?.chunks?.length) return null;
  const missing = [];
  for (let i = 0; i < transfer.chunks.length; i++) {
    if (transfer.chunks[i] === null) missing.push(i);
  }
  return missing;
}

function missingStoredEncryptedChunks(chunks) {
  if (!chunks?.length) return null;
  const missing = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i] === null) missing.push(i);
  }
  return missing;
}

function findDownloadRetryCandidates(itemId, currentSenderId = null) {
  return [...peerCardMetadata.entries()]
    .filter(([peerId, cards]) => (
      peerId &&
      peerId !== clientId &&
      peerId !== currentSenderId &&
      connectedPeers.has(peerId) &&
      cards?.has(itemId)
    ))
    .map(([peerId]) => peerId);
}

function retryDownloadFromDifferentClient(itemId, { silent = false } = {}) {
  const currentTransfer = binaryTransfers.get(itemId);
  const currentSenderId = currentTransfer?.senderId || pendingDownloadSourceIds.get(itemId) || null;
  const missingChunks = missingTransferChunks(currentTransfer);
  const triedSources = !currentTransfer ? (pendingDownloadTriedSources.get(itemId) || new Set()) : null;
  const candidates = findDownloadRetryCandidates(itemId, currentSenderId)
    .filter(peerId => !triedSources?.has(peerId));
  if (!candidates.length) {
    if (silent) return;
    showToast('No other client has this file right now.');
    return;
  }

  const sourceClientId = candidates[0];
  if (currentTransfer) {
    currentTransfer.senderId = sourceClientId;
    currentTransfer.retrySourceId = sourceClientId;
    updateTransferProgress(itemId, currentTransfer.received / currentTransfer.totalChunks, currentTransfer);
  } else {
    pendingDownloadSourceIds.set(itemId, sourceClientId);
    if (!pendingDownloadTriedSources.has(itemId)) pendingDownloadTriedSources.set(itemId, new Set());
    pendingDownloadTriedSources.get(itemId).add(sourceClientId);
  }
  requestSyncFrom(sourceClientId, itemId, missingChunks, { silent });
}

function clearAutomaticDownloadRetry(itemId) {
  const timer = downloadSourceRetryTimers.get(itemId);
  if (timer) clearTimeout(timer);
  downloadSourceRetryTimers.delete(itemId);
}

function scheduleAutomaticDownloadRetry(itemId, transfer) {
  clearAutomaticDownloadRetry(itemId);
  if (!itemId || !transfer || transfer.totalChunks && transfer.received >= transfer.totalChunks) return;
  const timer = setTimeout(() => {
    downloadSourceRetryTimers.delete(itemId);
    const currentTransfer = binaryTransfers.get(itemId);
    const currentItem = items.get(itemId);
    if ((!currentTransfer && !expectsIncomingChunks(currentItem)) || currentTransfer?.totalChunks && currentTransfer.received >= currentTransfer.totalChunks) return;
    const previousSenderId = currentTransfer?.senderId || transfer.senderId || null;
    retryDownloadFromDifferentClient(itemId, { silent: true });
    const nextTransfer = binaryTransfers.get(itemId);
    if (nextTransfer?.senderId && nextTransfer.senderId !== previousSenderId) {
      downloadSourceRetryAttempts.set(itemId, (downloadSourceRetryAttempts.get(itemId) || 0) + 1);
      debugLog('retry-download-source', { itemId, from: previousSenderId, to: nextTransfer.senderId, attempts: downloadSourceRetryAttempts.get(itemId) });
    }
    const remainingTransfer = binaryTransfers.get(itemId);
    if (remainingTransfer || expectsIncomingChunks(items.get(itemId))) {
      scheduleAutomaticDownloadRetry(itemId, remainingTransfer || {
        senderId: nextTransfer?.senderId || previousSenderId || null,
        received: 0,
        totalChunks: 0,
      });
    }
  }, DOWNLOAD_SOURCE_RETRY_DELAY_MS);
  downloadSourceRetryTimers.set(itemId, timer);
}

function armRecoveryTimersForIncompleteReceives() {
  for (const [itemId, transfer] of binaryTransfers) scheduleAutomaticDownloadRetry(itemId, transfer);
  for (const item of items.values()) {
    if (!expectsIncomingChunks(item) || downloadSourceRetryTimers.has(item.id)) continue;
    scheduleAutomaticDownloadRetry(item.id, {
      senderId: null,
      received: 0,
      totalChunks: 0,
    });
  }
}

function expectsIncomingChunks(item) {
  return item && item.type !== 'text' && item.type !== 'encrypted' && !item.rawBuffer && !item.dataUrl;
}

function showPendingReceiveProgress(itemId, senderId) {
  if (itemId && senderId && !pendingDownloadSourceIds.has(itemId)) pendingDownloadSourceIds.set(itemId, senderId);
  if (!itemId || document.getElementById('card-' + itemId)?.querySelector('.inbound-progress')) return;
  updateTransferProgress(itemId, 0, {
    senderId,
    received: 0,
    totalChunks: 0,
    currentChunk: 0,
    startTime: Date.now(),
  });
}

function closeAllModals() {
  closeTokenModal();
  closePeersModal();
  closePeerDetailModal();
  closeClearModal();
  closeChatArchiveModal();
  closeChatClearModal();
  closeLeaveModal();
  toggleChatPanel(false);
}

function clearAllItems() {
  const hadItems = items.size > 0;
  const hadChat = chatMessages.length > 0;
  if (hadItems) {
    for (const id of [...items.keys()]) {
      wsSend({ type: 'relay', payload: { type: 'item_deleted', itemId: id } }, cardEncryptionKeys.get(id));
    }
  }
  items.clear();
  cardEncryptionKeys.clear();
  binaryTransfers.clear();
  clearAllOutboundRetries();
  outboundTransfers.clear();
  remoteTransferStatuses.clear();
  transferStatusPublishTimes.clear();
  pendingChunkRequestBatches.clear();
  releaseSendWakeLock();
  editTimers.forEach(clearTimeout);
  editTimers.clear();
  document.getElementById('cards').innerHTML = '';
  updateEmpty();
  if (hadChat) clearChat({ broadcast: true });
  showToast(hadChat ? 'Space cleared' : 'All cards cleared');
}

function openTokenModal() {
  if (!token) return;
  document.getElementById('token-modal-token').textContent = formatToken(token);
  updateTokenModalSharePreview();
  const modal = document.getElementById('token-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  startPairingMode({ modal: true });
  refreshIcons();
}

function renderTokenModalQr(url) {
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
}

function updateTokenModalSharePreview() {
  if (!token) return;
  const url = tokenShareUrl(token);
  document.getElementById('token-modal-url').textContent = url;
  renderTokenModalQr(url);
}

function closeTokenModal() {
  const modal = document.getElementById('token-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  stopPairingMode({ modal: true });
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
  refreshIcons();
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
  if (innerMsg.type === 'relay') handlePayload(innerMsg.payload, true, key, senderId);
}

async function applyEncryptedMessages(encryptedMessages, key) {
  const ordered = [...encryptedMessages].sort((a, b) => {
    const aKind = a.meta?.payloadType;
    const bKind = b.meta?.payloadType;
    if (aKind === 'item_added' && bKind !== 'item_added') return -1;
    if (bKind === 'item_added' && aKind !== 'item_added') return 1;
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
  if (msg.senderId && connectedPeers.has(msg.senderId)) setPeerCompatibility(msg.senderId, 'compatible');
  return true;
}

function encryptedMetaForMessage(msg) {
  if (msg?.type !== 'relay') return { messageType: msg?.type || 'unknown' };
  const payload = msg.payload || {};
  if (payload.type === 'item_added' && payload.item) {
    return {
      messageType: 'relay',
      payloadType: 'item_added',
      itemId: payload.item.id
    };
  }
  if (payload.type === 'chat_line') {
    return {
      messageType: 'relay',
      payloadType: 'chat_line'
    };
  }
  if (payload.type === 'chat_cleared') {
    return {
      messageType: 'relay',
      payloadType: 'chat_cleared'
    };
  }
  if (payload.type === 'sync_state' && payload.chatMessages?.length) {
    return {
      messageType: 'relay',
      payloadType: 'sync_state'
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
    ? `Receiving ${item.receivedEncryptedChunks || 0}/${item.totalEncryptedChunks}`
    : 'Receiving';
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
      encryptedMeta: { payloadType: 'encrypted_binary_chunk', itemId, totalChunks },
      encryptedMessages: [],
      encryptedChunkIndexes: [],
      encryptedBinaryChunks: new Array(totalChunks).fill(null),
      receivedEncryptedChunks: 0,
      totalEncryptedChunks: totalChunks,
      encrypted: true,
      addedAt: Date.now()
    };
    items.set(item.id, item);
    updateEmpty();
  } else {
    item.encryptedBinaryChunks ||= new Array(totalChunks).fill(null);
    item.totalEncryptedChunks = totalChunks || item.totalEncryptedChunks;
  }
  return item;
}

function storeEncryptedBinaryChunk(header, payload) {
  if (!isValidChunkSet(header?.ci, header?.tc)) return 0;
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
      const timeEl = cardElement(existing.id)?.querySelector('.card-time');
      if (timeEl) timeEl.dataset.addedAt = meta.addedAt;
      refreshCardTimes();
    }
    updateEncryptedPlaceholderCard(existing);
    return;
  }

  const item = {
    id: groupId,
    type: 'encrypted',
    encryptedMeta: meta,
    encryptedMessages: [message],
    encryptedChunkIndexes: [],
    receivedEncryptedChunks: 0,
    encrypted: true,
    addedAt: meta.addedAt || Date.now()
  };
  items.set(item.id, item);
  updateEmpty();
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
    runPendingInitialSyncIfReady();
    retryPendingChunksAfterDataReconnect();
  };
  dataWs.onmessage = async e => {
    try {
      if (e.data instanceof ArrayBuffer) handleBinaryMessage(e.data, 'ws');
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
    encryptionEnabled = true;
  }
  updateEncryptionControl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    wsRetryDelay = 1000;
    setDot('connected');
    loadWebRtcConfig().catch(() => {});
    publishKeyProof();
    publishPairingMode();
    publishClientMetrics();
    startMetricsPing();
    publishLocalManifest();
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
    closeAllWebRtcPeers();
    stopMetricsPing();
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

function setPeerCompatibility(peerId, status) {
  if (!peerId || peerId === clientId) return;
  const peer = connectedPeers.get(peerId);
  if (!peer) return;
  peer.compatibility = status;
  if (status === 'compatible') ensureWebRtcPeer(peerId).catch(error => setWebRtcStartFailed(peerId, error));
  else closeWebRtcPeer(peerId);
  const timer = peerCompatibilityTimers.get(peerId);
  if (timer) {
    clearTimeout(timer);
    peerCompatibilityTimers.delete(peerId);
  }
  if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
  updatePeerCount();
}

function armPeerCompatibilityTimeout(peerId) {
  if (!peerId || peerId === clientId) return;
  const existing = peerCompatibilityTimers.get(peerId);
  if (existing) clearTimeout(existing);
  peerCompatibilityTimers.set(peerId, setTimeout(() => {
    if (connectedPeers.get(peerId)?.compatibility === 'pending') setPeerCompatibility(peerId, 'incompatible');
  }, KEY_PROOF_TIMEOUT_MS));
}

async function publishKeyProof() {
  if (!encryptionKey) return false;
  const proof = await encryptMessage(JSON.stringify({
    kind: 'clipshare-key-proof',
    clientId,
    issuedAt: Date.now(),
  }), encryptionKey);
  return sendPriorityJson({ type: 'key_proof', proof });
}

async function applyKeyProof(msg) {
  const senderId = msg?.senderId;
  if (!senderId || senderId === clientId || !connectedPeers.has(senderId) || !encryptionKey) return;
  try {
    const proof = JSON.parse(await decryptMessage(msg.proof, encryptionKey));
    if (proof?.kind === 'clipshare-key-proof' && proof.clientId === senderId) {
      setPeerCompatibility(senderId, 'compatible');
      return;
    }
  } catch { }
  setPeerCompatibility(senderId, 'incompatible');
}

async function wsSend(msg, keyOverride = null, priority = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const key = keyOverride || encryptionKey;
  if (!key) return false;
  const jsonStr = JSON.stringify(msg);
  const encrypted = await encryptMessage(jsonStr, key);
  const envelope = { type: 'encrypted', data: encrypted, meta: encryptedMetaForMessage(msg) };
  if (msg.targetId) envelope.targetId = msg.targetId;
  if (priority) return sendPriorityJson(envelope);
  ws.send(JSON.stringify(envelope));
  return true;
}

// ── Message handling ─────────────────────────────────────────────────
async function handleServerMessage(msg) {
  if (msg.type === 'welcome') {
    clientCount = msg.peerCount + 1;
    connectedPeers.clear();
    peerCardMetadata.clear();
    roomManifest.clear();
    manifestRevisions.clear();
    peerCounter = 0;
    selfPeerInfo = { label: String(msg.selfPeerNumber || 1), ip: msg.clientIp || '' };
    Object.assign(selfClientMetrics, normalizeClientMetrics({ ...selfClientMetrics, ...(msg.metrics || {}) }));
    (msg.peerInfos || []).forEach(peer => {
      const peerId = peer.clientId;
      if (peerId === clientId) return;
      peerCounter = Math.max(peerCounter, Number(peer.peerNumber) || peerCounter + 1);
      connectedPeers.set(peerId, {
        label: String(peer.peerNumber || peerCounter),
        ip: peer.ip || '',
        metrics: normalizeClientMetrics(peer.metrics || {}),
        compatibility: 'pending',
      });
      armPeerCompatibilityTimeout(peerId);
    });
    updatePairingHosts(msg.pairingHosts || []);
    await applyManifestSnapshot(msg.manifest || []);
    updatePeerCount();
    encryptionEnabled = !!encryptionKey;
    if ((msg.sources || []).length && !items.size) {
      pendingInitialSyncSources = msg.sources || [];
      runPendingInitialSyncIfReady();
    }
  } else if (msg.type === 'peer_joined') {
    clientCount++;
    peerCounter = Math.max(peerCounter + 1, Number(msg.peerNumber) || 0);
    connectedPeers.set(msg.clientId, {
      label: String(msg.peerNumber || peerCounter),
      ip: msg.ip || '',
      metrics: normalizeClientMetrics(msg.metrics || {}),
      compatibility: 'pending',
    });
    armPeerCompatibilityTimeout(msg.clientId);
    updatePeerCount();
    publishKeyProof();
    sendSyncState(msg.clientId);
    armRecoveryTimersForIncompleteReceives();
  } else if (msg.type === 'peer_left') {
    clientCount = Math.max(1, clientCount - 1);
    closeWebRtcPeer(msg.clientId);
    connectedPeers.delete(msg.clientId);
    const timer = peerCompatibilityTimers.get(msg.clientId);
    if (timer) clearTimeout(timer);
    peerCompatibilityTimers.delete(msg.clientId);
    peerCardMetadata.delete(msg.clientId);
    clearRemoteTransferStatusesForPeer(msg.clientId);
    for (const [itemId, peerMap] of outboundTransfers) {
      if (peerMap.has(msg.clientId)) {
        peerMap.delete(msg.clientId);
        if (peerMap.size === 0) outboundTransfers.delete(itemId);
        refreshOutboundUI(itemId);
      }
    }
    removeOrphanedIncomingCards();
    updatePeerCount();
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
  } else if (msg.type === 'metrics_pong') {
    const sentAt = Number(msg.sentAt);
    if (Number.isFinite(sentAt)) {
      selfClientMetrics.pingMs = Math.max(0, Date.now() - sentAt);
      publishClientMetrics();
      if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
    }
  } else if (msg.type === 'client_metrics_updated') {
    const metrics = normalizeClientMetrics(msg.metrics || {});
    if (msg.clientId === clientId) {
      Object.assign(selfClientMetrics, metrics);
    } else if (connectedPeers.has(msg.clientId)) {
      connectedPeers.get(msg.clientId).metrics = metrics;
    }
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
  } else if (msg.type === 'metadata_updated') {
    debugLog(msg.senderId === clientId ? 'announce-stored' : 'metadata-updated', {
      senderId: msg.senderId,
      itemId: msg.itemId,
      action: msg.action,
      stored: msg.stored,
    });
    armRecoveryTimersForIncompleteReceives();
  } else if (msg.type === 'metadata_snapshot') {
    debugLog('foreground-check-snapshot', { sources: msg.sources?.length || 0 });
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
    syncMissingFromSources(msg.sources || []);
    armRecoveryTimersForIncompleteReceives();
  } else if (msg.type === 'manifest_updated') {
    await applyManifestRecord(msg.record);
    if (msg.record?.ownerId && msg.record.ownerId !== clientId && !msg.record.deleted && !items.has(msg.record.itemId)) {
      requestSyncFrom(msg.record.ownerId, msg.record.itemId, null, { silent: true });
    }
    if (document.getElementById('peers-modal').classList.contains('open')) openPeersModal();
    armRecoveryTimersForIncompleteReceives();
  } else if (msg.type === 'key_proof') {
    await applyKeyProof(msg);
  } else if (msg.type === 'pairing_hosts') {
    updatePairingHosts(msg.hosts || []);
  } else if (msg.type === 'pairing_rejected') {
    showToast(`${peerDisplayName(msg.activeHostId, msg.activeHostPeerNumber)} is already in pairing mode`);
    if (msg.activeHostId) {
      updatePairingHosts([{
        clientId: msg.activeHostId,
        peerNumber: msg.activeHostPeerNumber,
        pairingVersion: 'speke-v1',
        expiresAt: Date.now() + Math.max(0, Number(msg.retryAfterMs) || 0),
        pairingWindowExpiresAt: Date.now() + Math.max(0, Number(msg.pairingWindowRetryAfterMs || msg.retryAfterMs) || 0),
      }]);
    }
    stopPairingMode({ all: true });
  } else if (msg.type === 'pairing_host_removed') {
    showToast(msg.reason === 'unused_pin_limit' ? 'Pairing timed out' : 'Pairing stopped by server');
    updatePairingHosts([]);
    closeTokenModal();
    stopPairingMode({ all: true });
  } else if (msg.type === 'pairing_rate_limited') {
    const seconds = Math.max(1, Math.ceil((Number(msg.retryAfterMs) || 0) / 1000));
    pairingJoinFailed(`Wait ${seconds}s before trying again`);
  } else if (msg.type === 'pairing_request') {
    await answerPairingRequest(msg);
  } else if (msg.type === 'pairing_response') {
    await handlePairingJoinMessage(msg);
  } else if (msg.type === 'pairing_confirm') {
    const expectedSenderId = pairingHostPendingRequests.get(msg.requestId);
    if (expectedSenderId && expectedSenderId === msg.senderId) {
      pairingHostPendingRequests.delete(msg.requestId);
      pairingCurrentPinUsed = true;
      pairingUnusedPinCount = 0;
      showToast(`${peerDisplayName(msg.senderId)} paired successfully`);
      await rotatePairingPin();
    }
  } else if (msg.type === 'encrypted') {
    if (msg.meta?.payloadType === 'item_deleted') {
      forgetPeerCardMetadata(msg.senderId, msg.meta.itemId);
    }
    if (encryptionKey) {
      try {
        await applyEncryptedMessage(msg.data, encryptionKey, msg.senderId);
        if (msg.senderId && connectedPeers.has(msg.senderId)) setPeerCompatibility(msg.senderId, 'compatible');
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
  if (!receivedEncrypted) return;

  if (payload.type === 'sync_state') {
    debugLog('retrieve-sync-state', { senderId, items: payload.items?.length || 0, chatMessages: payload.chatMessages?.length || 0, encrypted: receivedEncrypted });
    (payload.chatMessages || []).forEach(message => appendChatMessage(message));
    (payload.items || []).forEach(item => {
      if (!items.has(item.id)) {
        if (payloadKey) cardEncryptionKeys.set(item.id, payloadKey);
        const normalized = markEncrypted(item);
        items.set(item.id, normalized);
        if (canPublishCardHolder(normalized)) publishClientCardMetadata(normalized);
      }
    });
    renderAll();
    (payload.items || []).forEach(item => {
      const normalized = markEncrypted(item);
      if (expectsIncomingChunks(normalized)) showPendingReceiveProgress(normalized.id, senderId);
    });

  } else if (payload.type === 'sync_request') {
    debugLog('retrieve-request-received', { requesterId: payload.requesterId, itemId: payload.itemId, missingChunks: payload.missingChunks?.length });
    sendSyncState(payload.requesterId, payload.itemId || null, payload.missingChunks || null);

  } else if (payload.type === 'transfer_status') {
    applyRemoteTransferStatus(payload);

  } else if (payload.type === 'item_added') {
    const item = markEncrypted(payload.item);
    if (item && !items.has(item.id)) {
      debugLog('retrieve-card-metadata', { senderId, itemId: item?.id, type: item?.type, filename: item?.filename, size: item?.size, encrypted: !!item?.encrypted });
      if (payloadKey) cardEncryptionKeys.set(item.id, payloadKey);
      items.set(item.id, item);
      prependCard(item);
      updateEmpty();
      if (canPublishCardHolder(item)) publishClientCardMetadata(item);
      if (expectsIncomingChunks(item)) showPendingReceiveProgress(item.id, senderId);
    }

  } else if (payload.type === 'item_deleted') {
    forgetPeerCardMetadata(senderId, payload.itemId);
    const hadItem = items.delete(payload.itemId);
    if (hadItem) removeManifestMeta(payload.itemId, Date.now());
    cardEncryptionKeys.delete(payload.itemId);
    binaryTransfers.delete(payload.itemId);
    clearOutboundRetriesForItem(payload.itemId);
    chunkScheduler.cancelItem(payload.itemId);
    outboundTransfers.delete(payload.itemId);
    clearAutomaticDownloadRetry(payload.itemId);
    downloadSourceRetryAttempts.delete(payload.itemId);
    pendingDownloadSourceIds.delete(payload.itemId);
    pendingDownloadTriedSources.delete(payload.itemId);
    pendingChunkRequestBatches.delete(payload.itemId);
    downloadLogSources.delete(payload.itemId);
    clearTransferStatusesForItem(payload.itemId);
    updateSendWakeLock();
    removeCardAnimated(payload.itemId, updateEmpty);

  } else if (payload.type === 'item_updated') {
    if (payloadKey) cardEncryptionKeys.set(payload.itemId, payloadKey);
    const item = items.get(payload.itemId);
    if (!item || item.type !== 'text') return;
    item.content = payload.content;
    const el = cardElement(payload.itemId)?.querySelector('.text-content');
    if (el && document.activeElement !== el) el.innerHTML = linkify(payload.content);

  } else if (payload.type === 'chunk_ack') {
    handleChunkAck(payload.itemId, payload.totalChunks, payload.peerId, payload.receivedChunks, payload.chunkIndex);
  } else if (payload.type === 'webrtc_offer') {
    handleWebRtcOffer(payload, senderId);
  } else if (payload.type === 'webrtc_answer') {
    handleWebRtcAnswer(payload, senderId);
  } else if (payload.type === 'webrtc_ice') {
    handleWebRtcIce(payload, senderId);
  } else if (payload.type === 'chat_line') {
    appendChatMessage(payload.message);
  } else if (payload.type === 'chat_reaction') {
    toggleChatReaction(payload.messageId, payload.token, { broadcast: false, reactorId: payload.reactorId });
  } else if (payload.type === 'chat_cleared') {
    clearChat();
  }
}

// ── Sync ─────────────────────────────────────────────────────────────
function sendSyncState(targetClientId, requestedItemId = null, requestedChunks = null) {
  const sendableItems = [...items.values()].filter(i =>
    (!requestedItemId || i.id === requestedItemId) &&
    (i.type === 'text' || i.rawBuffer)
  );
  const syncItems = sendableItems
    .filter(item => !cardEncryptionKeys.get(item.id))
    .map(item => {
      const { dataUrl, rawBuffer, ...meta } = item;
      return item.type === 'text' ? item : meta;
    });
  debugLog('retrieve-send-state', { targetClientId, requestedItemId, requestedChunks: requestedChunks?.length, items: sendableItems.length, chatMessages: chatMessages.length });
  if (syncItems.length || (!requestedItemId && chatMessages.length)) {
    wsSend({
      type: 'relay',
      targetId: targetClientId,
      payload: { type: 'sync_state', items: syncItems, chatMessages: requestedItemId ? [] : chatMessages },
    });
  }
  sendableItems.forEach(item => {
    const cardKey = cardEncryptionKeys.get(item.id) || encryptionKey;
    if (!cardKey) return;
    debugLog('starting', { itemId: item.id, targetClientId, type: item.type, filename: item.filename, size: item.size, encrypted: !!cardKey, source: 'sync' });
    if (item.type === 'text') {
      wsSend({ type: 'relay', targetId: targetClientId, payload: { type: 'item_added', item } }, cardKey, true);
      return;
    }
    // Send item metadata (no binary payload)
    const { dataUrl, rawBuffer, ...meta } = item;
    wsSend({ type: 'relay', targetId: targetClientId, payload: { type: 'item_added', item: meta } }, cardKey, true);

    sendFileChunksBinaryEncrypted(item, cardKey, targetClientId, requestedChunks);
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

async function handleFiles(files, { mentionInChat = false } = {}) {
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      showToast(`"${file.name}" exceeds the 128 MB limit`);
      continue;
    }
    const providedMimeType = normalizeKnownFileMime(file.type);
    const mimeType = isGenericFileMime(providedMimeType) ? (await estimateFileMimeType(file)) || providedMimeType : providedMimeType;
    const itemType = mimeType.startsWith('image/') ? 'image' : 'file';
    const item = { id: randomUUID(), type: itemType, filename: file.name, mimeType, size: file.size, addedAt: Date.now() };
    item.rawBuffer = await file.arrayBuffer();
    item.dataUrl = URL.createObjectURL(file);
    await prepareImageThumbnail(item, file, { force: mentionInChat });
    addAndBroadcast(item);
    if (mentionInChat) appendChatMessage(chatMessageFromCard(item), { broadcast: true });
  }
}

function createTextCard() {
  const item = { id: randomUUID(), type: 'text', content: '', addedAt: Date.now() };
  addAndBroadcast(item);
  requestAnimationFrame(() => {
    const el = cardElement(item.id)?.querySelector('.text-content');
    if (el) el.focus();
  });
}

function addAndBroadcast(item) {
  if (!encryptionKey) {
    showToast('Secure share key is not ready yet.');
    return;
  }
  item.encrypted = true;
  const itemKey = encryptionKey;
  cardEncryptionKeys.set(item.id, itemKey);
  items.set(item.id, item);
  rememberManifestMeta(clientId, cardMetadataFromItem(item), nextManifestRevision(item.id));
  prependCard(item);
  updateEmpty();
  publishClientCardMetadata(item);
  debugLog('starting', { itemId: item.id, type: item.type, filename: item.filename, size: item.size, encrypted: !!itemKey, source: 'broadcast' });

  if (item.type === 'text') {
    wsSend({ type: 'relay', payload: { type: 'item_added', item } }, itemKey, true);
  } else {
    // Strip local-only fields before broadcasting item metadata
    const { dataUrl, rawBuffer, ...meta } = item;
    wsSend({ type: 'relay', payload: { type: 'item_added', item: meta } }, itemKey, true);
    sendFileChunksBinaryEncrypted(item, itemKey);
  }
}

// ── Chunked file sending ────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendChunkWhenDataSocketReady(item, sendOnce) {
  while (items.has(item.id)) {
    if (await sendOnce()) return true;
    await sleep(250);
  }
  return false;
}

async function drainWS() {
  // Pace sending to match actual network throughput so the sender's
  // progress bar stays in sync with the receiver's.
  const highWater = BINARY_CHUNK_SIZE * 2;
  const start = Date.now();
  while (dataWs && dataWs.readyState === WebSocket.OPEN && dataWs.bufferedAmount > highWater) {
    await sleep(8);
    if (Date.now() - start > 10000) break;
  }
}

async function waitForDataWS() {
  if (dataWs && dataWs.readyState === WebSocket.OPEN) return true;
  if (!dataWs || dataWs.readyState === WebSocket.CLOSED) connectDataWS();
  const start = Date.now();
  while (dataWs && dataWs.readyState === WebSocket.CONNECTING) {
    await sleep(20);
    if (Date.now() - start > 5000) break;
  }
  return !!dataWs && dataWs.readyState === WebSocket.OPEN;
}

function trackOutboundPeer(itemId, trackKey, resendMissing = null) {
  if (!outboundTransfers.has(itemId)) outboundTransfers.set(itemId, new Map());
  const peerMap = outboundTransfers.get(itemId);
  const existing = peerMap.get(trackKey) || {};
  peerMap.set(trackKey, {
    sent: existing.sent || 0,
    total: existing.total || 0,
    startTime: existing.startTime || Date.now(),
    ackedChunks: existing.ackedChunks || new Set(),
    retryAttempts: existing.retryAttempts || 0,
    retryTimer: existing.retryTimer || null,
    initialDone: existing.initialDone || false,
    complete: existing.complete || false,
    currentChunk: existing.currentChunk || 0,
    resendMissing: resendMissing || existing.resendMissing || null,
  });
  refreshOutboundUI(itemId);
  updateSendWakeLock();
  return peerMap.get(trackKey);
}

function seedContinuationProgress(itemId, peerId, totalChunks, missingChunks) {
  const missing = normalizeChunkIndexes(missingChunks, totalChunks);
  if (!missing || !missing.length) return;
  const p = outboundTransfers.get(itemId)?.get(peerId);
  if (!p) return;
  const missingSet = new Set(missing);
  p.total = totalChunks;
  p.ackedChunks ||= new Set();
  for (let i = 0; i < totalChunks; i++) {
    if (!missingSet.has(i)) p.ackedChunks.add(i);
  }
  p.sent = p.ackedChunks.size;
  updateOutboundRow(itemId, peerId, p.sent, p.total);
}

function makeOutboundProgress(itemId, trackKey, resendMissing = null) {
  trackOutboundPeer(itemId, trackKey, resendMissing);
  return (sent, total, currentChunk = null) => {
    const peerMap = outboundTransfers.get(itemId);
    const p = peerMap?.get(trackKey);
    if (p) {
      p.total = total;
      p.sent = p.resendMissing ? p.ackedChunks.size : sent;
      if (Number.isFinite(currentChunk)) p.currentChunk = Number(currentChunk) + 1;
    }
    updateOutboundRow(itemId, trackKey, p?.sent ?? sent, total);
  publishTransferStatus({
    itemId,
    sourceId: clientId,
    targetId: trackKey,
    current: p?.currentChunk || currentChunk || sent,
    done: p?.sent ?? sent,
    total,
    transport: p?.transport || '',
  });
    if (p) finishOutboundPeerIfComplete(itemId, trackKey, p);
  };
}

function trackOutboundPeers(itemId, peerIds, resendMissingForPeer) {
  if (!outboundTransfers.has(itemId)) outboundTransfers.set(itemId, new Map());
  for (const pid of peerIds) {
    trackOutboundPeer(itemId, pid, indexes => resendMissingForPeer(pid, indexes));
  }
  refreshOutboundUI(itemId);
}

function missingAckedChunks(progress) {
  const total = progress?.total || 0;
  const acked = progress?.ackedChunks;
  if (!total || !acked) return [];
  const missing = [];
  for (let i = 0; i < total; i++) {
    if (!acked.has(i)) missing.push(i);
  }
  return missing;
}

function clearChunkRetry(progress) {
  if (progress?.retryTimer) {
    clearTimeout(progress.retryTimer);
    progress.retryTimer = null;
  }
}

function clearOutboundRetriesForItem(itemId) {
  const peerMap = outboundTransfers.get(itemId);
  if (!peerMap) return;
  for (const progress of peerMap.values()) clearChunkRetry(progress);
}

function clearAllOutboundRetries() {
  for (const peerMap of outboundTransfers.values()) {
    for (const progress of peerMap.values()) clearChunkRetry(progress);
  }
}

function retryPendingChunksAfterDataReconnect() {
  for (const [itemId, peerMap] of outboundTransfers) {
    for (const [peerId, progress] of peerMap) {
      if (!progress?.initialDone || !progress.resendMissing || progress.sent >= progress.total) continue;
      clearChunkRetry(progress);
      progress.retryAttempts = 0;
      const missing = missingAckedChunks(progress);
      if (!missing.length) continue;
      debugLog('retry-chunks-data-socket-open', { itemId, peerId, missing: missing.length });
      chunkScheduler.enqueue(itemId, -(progress.total || 0), () => retryChunkGenerator(itemId, peerId, missing, progress.resendMissing));
    }
  }
}

function finishOutboundPeerIfComplete(itemId, peerId, progress) {
  if (!progress.total || progress.sent < progress.total) return;
  if (progress.complete) return;
  progress.complete = true;
  const item = items.get(itemId);
  if (item?.size && progress.startTime) recordTransferMetric('upload', item.size, progress.startTime);
  publishTransferStatus({
    itemId,
    sourceId: clientId,
    targetId: peerId,
    current: progress.total,
    done: progress.total,
    total: progress.total,
    transport: progress.transport || '',
    status: 'done',
    force: true,
  });
  clearChunkRetry(progress);
  setTimeout(() => {
    const pm = outboundTransfers.get(itemId);
    if (pm) { pm.delete(peerId); if (!pm.size) outboundTransfers.delete(itemId); }
    refreshOutboundUI(itemId);
    schedulePeersModalRefresh();
    updateSendWakeLock();
  }, 1500);
}

function scheduleChunkRetry(itemId, peerId, progress) {
  if (!progress?.initialDone || !progress.resendMissing) return;
  if (progress.sent >= progress.total) return;
  if (progress.retryTimer) return;
  if (progress.retryAttempts >= CHUNK_RETRY_MAX_ATTEMPTS) return;
  progress.retryTimer = setTimeout(() => {
    progress.retryTimer = null;
    const current = outboundTransfers.get(itemId)?.get(peerId);
    if (!current || current.sent >= current.total) return;
    const missing = missingAckedChunks(current);
    if (!missing.length) return;
    current.retryAttempts++;
    debugLog('retry-chunks', { itemId, peerId, attempt: current.retryAttempts, missing: missing.length });
    chunkScheduler.enqueue(itemId, -(current.total || 0), () => retryChunkGenerator(itemId, peerId, missing, current.resendMissing));
  }, CHUNK_RETRY_DELAY_MS);
}

async function* retryChunkGenerator(itemId, peerId, chunkIndexes, resendMissing) {
  await resendMissing(chunkIndexes);
  const progress = outboundTransfers.get(itemId)?.get(peerId);
  if (progress) scheduleChunkRetry(itemId, peerId, progress);
}

function markOutboundInitialDone(itemId, peerIds) {
  const pm = outboundTransfers.get(itemId);
  if (!pm) return;
  for (const peerId of peerIds) {
    const p = pm.get(peerId);
    if (!p) continue;
    p.initialDone = true;
    scheduleChunkRetry(itemId, peerId, p);
  }
}

// ── Chunked file sending (encrypted binary path) ─────────────────────

async function sendEncryptedBinaryChunk(item, key, targetId, chunkIndex, totalChunks) {
  if (!items.has(item.id) || !item.rawBuffer) return false;
  const start = chunkIndex * BINARY_CHUNK_SIZE;
  const chunkBytes = new Uint8Array(item.rawBuffer, start, Math.min(BINARY_CHUNK_SIZE, item.rawBuffer.byteLength - start));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, chunkBytes));
  const payload = new Uint8Array(12 + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, 12);

  const header = { t: 'efc', i: item.id, ci: chunkIndex, tc: totalChunks, sid: clientId, crc32: crc32Bytes(payload) };
  if (targetId) header.tid = targetId;
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const frame = new Uint8Array(4 + headerBytes.length + payload.length);
  new DataView(frame.buffer).setUint32(0, headerBytes.length, false);
  frame.set(headerBytes, 4);
  frame.set(payload, 4 + headerBytes.length);

  if (targetId && webRtcChannelOpen(targetId) && await sendWebRtcBinaryFrame(targetId, frame)) {
    return 'webrtc';
  }

  if (!await waitForDataWS()) return false;
  await drainWS();
  if (dataWs && dataWs.readyState === WebSocket.OPEN) {
    dataWs.send(frame.buffer);
    return 'ws';
  }
  return false;
}

async function resendEncryptedBinaryChunks(item, key, targetId, chunkIndexes) {
  if (!item.rawBuffer) return;
  const totalChunks = Math.ceil(item.rawBuffer.byteLength / BINARY_CHUNK_SIZE) || 1;
  for (const i of chunkIndexes) {
    if (i < 0 || i >= totalChunks) continue;
    await sendChunkWhenDataSocketReady(item, () => sendEncryptedBinaryChunk(item, key, targetId, i, totalChunks));
  }
}

async function* fileChunkGeneratorBinaryEncrypted(item, key, targetId, onProgress, requestedChunks = null) {
  if (!item.rawBuffer) return;
  const buf = item.rawBuffer;
  const totalChunks = Math.ceil(buf.byteLength / BINARY_CHUNK_SIZE) || 1;
  const chunkIndexes = normalizeChunkIndexes(requestedChunks, totalChunks) || Array.from({ length: totalChunks }, (_, i) => i);
  if (targetId) seedContinuationProgress(item.id, targetId, totalChunks, requestedChunks);
  onProgress(0, totalChunks); // initialise outbound row; bar advances via ACKs
  logUploadStart(item.id, targetId, totalChunks, targetId && webRtcChannelOpen(targetId) ? 'webrtc' : '');

  for (const i of chunkIndexes) {
    if (!items.has(item.id)) return;
    let sent = false;
    let chunkTransport = '';
    if (targetId) {
      sent = await sendChunkWhenDataSocketReady(item, () => sendEncryptedBinaryChunk(item, key, targetId, i, totalChunks));
      const progress = outboundTransfers.get(item.id)?.get(targetId);
      if (sent === 'webrtc' && progress) progress.transport = 'webrtc';
      if (sent === 'webrtc') chunkTransport = 'webrtc';
    } else {
      const peers = [...connectedPeers.keys()];
      if (!peers.length) sent = true;
      else {
        sent = true;
        for (const peerId of peers) {
          const peerSent = await sendChunkWhenDataSocketReady(item, () => sendEncryptedBinaryChunk(item, key, peerId, i, totalChunks));
          const progress = outboundTransfers.get(item.id)?.get(peerId);
          if (peerSent === 'webrtc' && progress) progress.transport = 'webrtc';
          if (peerSent === 'webrtc') chunkTransport = 'webrtc';
          if (!peerSent) sent = false;
        }
      }
    }
    if (!sent) return;
    logUploadChunk(item.id, i, totalChunks, targetId, chunkTransport);
    yield;
  }
  if (targetId) markOutboundInitialDone(item.id, [targetId]);
  else markOutboundInitialDone(item.id, [...connectedPeers.keys()]);
  const doneTransport = targetId
    ? outboundTransfers.get(item.id)?.get(targetId)?.transport
    : [...(outboundTransfers.get(item.id)?.values() || [])].some(progress => progress.transport === 'webrtc') ? 'webrtc' : '';
  logUploadDone(item.id, targetId, doneTransport);
}

function sendFileChunksBinaryEncrypted(item, key, targetId, requestedChunks = null) {
  if (targetId) {
    const resendMissing = indexes => resendEncryptedBinaryChunks(item, key, targetId, indexes);
    const onProgress = makeOutboundProgress(item.id, targetId, resendMissing);
    chunkScheduler.enqueue(item.id, -(item.size || 0),
      () => fileChunkGeneratorBinaryEncrypted(item, key, targetId, onProgress, requestedChunks));
    return;
  }

  const peerIds = [...connectedPeers.keys()];
  if (!peerIds.length) {
    chunkScheduler.enqueue(item.id, item.size || 0,
      () => fileChunkGeneratorBinaryEncrypted(item, key, null, () => {}));
    return;
  }

  trackOutboundPeers(item.id, peerIds, (pid, indexes) => resendEncryptedBinaryChunks(item, key, pid, indexes));

  const onProgress = (sent, total) => {
    const pm = outboundTransfers.get(item.id);
    for (const pid of peerIds) {
      const p = pm?.get(pid);
      if (p) {
        p.total = total;
        p.sent = p.resendMissing ? p.ackedChunks.size : sent;
        p.currentChunk = sent;
      }
      updateOutboundRow(item.id, pid, p?.sent ?? sent, total);
      publishTransferStatus({
        itemId: item.id,
        sourceId: clientId,
        targetId: pid,
        current: p?.currentChunk || sent,
        done: p?.sent ?? sent,
        total,
        transport: p?.transport || '',
      });
    }
  };

  chunkScheduler.enqueue(item.id, item.size || 0,
    () => fileChunkGeneratorBinaryEncrypted(item, key, null, onProgress));
}

// ── Chunked file receiving (binary path) ────────────────────────────

function handleBinaryMessage(buffer, transport = 'ws') {
  if (buffer.byteLength < 4) return;
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, false);
  if (buffer.byteLength < 4 + headerLen) return;
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLen)));
  } catch { return; }
  if (header.t === 'efc') {
    if (!isValidChunkSet(header.ci, header.tc)) {
      debugLog('chunk-invalid', { itemId: header.i, chunkIndex: header.ci, totalChunks: header.tc, path: 'encrypted-binary' });
      return;
    }
    const key = cardEncryptionKeys.get(header.i) || encryptionKey;
    const payload = buffer.slice(4 + headerLen);
    const sid = header.sid;
    if (Number.isFinite(header.crc32) && crc32Bytes(new Uint8Array(payload)) !== (header.crc32 >>> 0)) {
      debugLog('chunk-crc-failed', { itemId: header.i, chunkIndex: header.ci, path: 'encrypted-binary' });
      return;
    }
    if (!key) {
      const receivedChunks = storeEncryptedBinaryChunk(header, payload);
      continueChunkRequestBatch(header.i, header.ci, sid);
      sendChunkAck(header.i, header.tc, sid, receivedChunks, header.ci);
      return;
    }
    crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload, 0, 12) }, key, payload.slice(12))
      .then(plain => {
        const receivedChunks = handleBinaryFileChunk(header.i, header.ci, header.tc, plain, sid, transport);
        sendChunkAck(header.i, header.tc, sid, receivedChunks, header.ci);
      })
      .catch(() => {
        const receivedChunks = storeEncryptedBinaryChunk(header, payload);
        continueChunkRequestBatch(header.i, header.ci, sid);
        sendChunkAck(header.i, header.tc, sid, receivedChunks, header.ci);
      });
    return;
  }
}

function sendChunkAck(itemId, totalChunks, senderId, receivedChunks, chunkIndex) {
  if (!senderId || !ws || ws.readyState !== WebSocket.OPEN) return;
  wsSend({
    type: 'relay',
    targetId: senderId,
    payload: { type: 'chunk_ack', itemId, totalChunks, receivedChunks, chunkIndex, peerId: clientId },
  }, null, true);
}

function handleChunkAck(itemId, totalChunks, peerId, receivedChunks, chunkIndex) {
  const pm = outboundTransfers.get(itemId);
  const p = pm?.get(peerId);
  if (!p) return;
  const normalizedTotal = Number(totalChunks);
  if (!p.total && Number.isInteger(normalizedTotal) && normalizedTotal > 0 && normalizedTotal <= MAX_TRANSFER_CHUNKS) {
    p.total = normalizedTotal;
  }
  if (!p.total) return;
  if (Number.isFinite(chunkIndex)) {
    const index = Number(chunkIndex);
    if (!isValidChunkIndex(index, p.total)) return;
    p.ackedChunks ||= new Set();
    p.ackedChunks.add(index);
    p.currentChunk = index + 1;
    p.sent = p.ackedChunks.size;
  } else if (Number.isFinite(receivedChunks)) {
    p.sent = Math.min(Math.max(receivedChunks, p.sent || 0), p.total);
  } else {
    return;
  }
  if (p.sent < p.total) scheduleChunkRetry(itemId, peerId, p);
  updateOutboundRow(itemId, peerId, p.sent, p.total);
  finishOutboundPeerIfComplete(itemId, peerId, p);
}

function handleBinaryFileChunk(itemId, chunkIndex, totalChunks, chunkBuffer, senderId, transport = '') {
  if (!isValidChunkSet(chunkIndex, totalChunks)) {
    debugLog('chunk-invalid', { itemId, chunkIndex, totalChunks, path: 'binary-receive' });
    return 0;
  }
  if (!binaryTransfers.has(itemId) && items.get(itemId)?.rawBuffer) return totalChunks;
  if (!binaryTransfers.has(itemId)) {
    binaryTransfers.set(itemId, { chunks: new Array(totalChunks).fill(null), chunkSources: new Array(totalChunks).fill(''), received: 0, totalChunks, senderId, currentChunk: 0, startTime: Date.now() });
    pendingDownloadTriedSources.delete(itemId);
  }
  const t = binaryTransfers.get(itemId);
  if (senderId) t.senderId = senderId;
  if (transport === 'webrtc') t.transport = 'webrtc';
  t.currentChunk = chunkIndex + 1;
  if (t.chunks[chunkIndex] === null) {
    logDownloadSourceStart(itemId, senderId || t.senderId, totalChunks, transport);
    logDownloadChunk(itemId, chunkIndex, totalChunks, senderId || t.senderId, transport);
    t.chunks[chunkIndex] = chunkBuffer;
    t.chunkSources[chunkIndex] = senderId || t.senderId || '';
    t.received++;
  }
  continueChunkRequestBatch(itemId, chunkIndex, senderId || t.senderId);
  updateTransferProgress(itemId, t.received / t.totalChunks, t);
  if (t.received === t.totalChunks) {
    logDownloadDone(itemId, t.chunkSources, t.transport || '');
    if (t.senderId) {
      publishTransferStatus({
        itemId,
        sourceId: t.senderId,
        targetId: clientId,
        current: t.totalChunks,
        done: t.totalChunks,
        total: t.totalChunks,
        chunkRuns: transferChunkRunsFromSources(t.chunkSources, t.totalChunks),
        transport: t.transport || '',
        status: 'done',
        force: true,
      });
    }
    binaryTransfers.delete(itemId);
    schedulePeersModalRefresh();
    clearAutomaticDownloadRetry(itemId);
    downloadSourceRetryAttempts.delete(itemId);
    pendingDownloadSourceIds.delete(itemId);
    pendingDownloadTriedSources.delete(itemId);
    pendingChunkRequestBatches.delete(itemId);
    finalizeTransferBinary(itemId, t.chunks, t.startTime);
  }
  return t.received;
}

async function finalizeTransferBinary(itemId, chunks, startTime = Date.now()) {
  const item = items.get(itemId);
  if (!item) return;
  const totalBytes = chunks.reduce((s, c) => s + c.byteLength, 0);
  recordTransferMetric('download', totalBytes, startTime);
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

function updateTransferProgress(itemId, fraction, transfer) {
  const card = cardElement(itemId);
  if (!card) {
    schedulePeersModalRefresh();
    return;
  }
  const pct = transferPercent(fraction);

  let section = card.querySelector('.inbound-progress');
  if (!section) {
    const sourceIds = transferSourceIdsFromChunks(transfer?.chunkSources, transfer?.senderId);
    section = document.createElement('div');
    section.className = 'inbound-progress';
    section.innerHTML = `<div class="outbound-progress-title">Receiving...</div>
<div class="outbound-peer-row">
  <div class="outbound-peer-label transfer-peer-slot">${peerIconStackHtml(sourceIds, 'transfer-peer-icons-inline')}</div>
  <div class="outbound-peer-progress"><div class="outbound-peer-fill" id="${escAttr('ib-fill-' + itemId)}" style="width:0%"></div></div>
  <span class="outbound-peer-eta" id="${escAttr('ib-eta-' + itemId)}">0%</span>
</div>`;
    card.insertBefore(section, card.querySelector('.card-footer'));
    requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add('ip-visible')));
  }
  const sourceSlot = section.querySelector('.transfer-peer-slot');
  if (sourceSlot) sourceSlot.innerHTML = peerIconStackHtml(transferSourceIdsFromChunks(transfer?.chunkSources, transfer?.senderId), 'transfer-peer-icons-inline');

  const fill = document.getElementById('ib-fill-' + itemId);
  if (fill) fill.style.width = pct + '%';
  updateChatCardDownloadState(itemId);
  const eta = document.getElementById('ib-eta-' + itemId);
  if (eta) eta.textContent = `${pct}%`;
  if (transfer?.senderId) {
    publishTransferStatus({
      itemId,
      sourceId: transfer.senderId,
      targetId: clientId,
      current: transfer.currentChunk || transfer.received || 0,
      done: transfer.received || 0,
      total: transfer.totalChunks || 0,
      chunkRuns: transferChunkRunsFromSources(transfer.chunkSources, transfer.totalChunks),
      transport: transfer.transport || '',
      status: pct >= 100 ? 'done' : 'active',
      force: pct >= 100,
    });
  }
  if (pct >= 100) {
    clearAutomaticDownloadRetry(itemId);
    downloadSourceRetryAttempts.delete(itemId);
  } else if (transfer) {
    scheduleAutomaticDownloadRetry(itemId, transfer);
  }
  schedulePeersModalRefresh();
  refreshIcons();
}

function transferPercent(fraction) {
  return Math.max(0, Math.min(100, Math.round((Number(fraction) || 0) * 100)));
}

function transferPercentFromCounts(done, total) {
  return Number(total) ? transferPercent((Number(done) || 0) / Number(total)) : 0;
}

function refreshOutboundUI(itemId) {
  const card = cardElement(itemId);
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
    const pct = transferPercentFromCounts(p.sent, p.total);
    html += `<div class="outbound-peer-row">
      <div class="outbound-peer-label transfer-peer-slot">${peerIconStackHtml([key], 'transfer-peer-icons-inline')}</div>
      <div class="outbound-peer-progress"><div class="outbound-peer-fill" id="${escAttr(`ob-fill-${itemId}-${key}`)}" style="width:${pct}%"></div></div>
      <span class="outbound-peer-eta" id="${escAttr(`ob-eta-${itemId}-${key}`)}">${pct}%</span>
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
  refreshIcons();
}

function updateOutboundRow(itemId, key, sent, total) {
  const pct = transferPercentFromCounts(sent, total);
  const fill = document.getElementById(`ob-fill-${itemId}-${key}`);
  if (fill) fill.style.width = pct + '%';
  const eta = document.getElementById(`ob-eta-${itemId}-${key}`);
  if (!eta) { schedulePeersModalRefresh(); return; }
  eta.textContent = `${pct}%`;
  schedulePeersModalRefresh();
}

// ── Text editing ─────────────────────────────────────────────────────
function onTextFocus(id, el) {
  const item = items.get(id);
  if (!item) return;
  el.innerText = item.content;
  // move caret to end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function onTextBlur(id, el) {
  const item = items.get(id);
  if (!item) return;
  el.innerHTML = linkify(item.content);
  flushTextUpdate(id);
}

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
  binaryTransfers.delete(id);
  chunkScheduler.cancelItem(id);
  clearOutboundRetriesForItem(id);
  outboundTransfers.delete(id);
  clearAutomaticDownloadRetry(id);
  downloadSourceRetryAttempts.delete(id);
  pendingDownloadSourceIds.delete(id);
  pendingDownloadTriedSources.delete(id);
  pendingChunkRequestBatches.delete(id);
  downloadLogSources.delete(id);
  clearTransferStatusesForItem(id);
  updateSendWakeLock();
  removeManifestMeta(id, nextManifestRevision(id));
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
  [...items.values()]
    .filter(item => item.type !== 'encrypted')
    .sort((a, b) => b.addedAt - a.addedAt)
    .forEach(item => container.appendChild(buildCard(item)));
  updateEmpty();
  refreshIcons();
}

function prependCard(item) {
  if (item.type === 'encrypted') {
    updateEmpty();
    return;
  }
  const container = document.getElementById('cards');
  container.insertBefore(buildCard(item), container.firstChild);
  refreshIcons();
}

function finalizeCardInPlace(item) {
  const card = cardElement(item.id);
  if (!card) return;

  const body = card.querySelector('.card-body');
  if (body) {
    const imagePreviewUrl = item.thumbnailDataUrl || (isBrowserViewableImage(item.mimeType) ? item.dataUrl : '');
    const videoPreviewHtml = playableVideoCardHtml(item);
    let bodyHtml;
    if (item.type === 'image' && imagePreviewUrl) {
      bodyHtml = imageCardHtml(item, imagePreviewUrl);
    } else if (videoPreviewHtml) {
      bodyHtml = videoPreviewHtml;
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
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn-icon';
      downloadBtn.title = 'Download';
      downloadBtn.type = 'button';
      downloadBtn.innerHTML = '<i data-lucide="download"></i>';
      downloadBtn.addEventListener('click', () => downloadItem(item.id));
      deleteBtn.before(downloadBtn);
    }
  }

  const progress = card.querySelector('.inbound-progress');
  if (progress) {
    progress.classList.remove('ip-visible');
    progress.addEventListener('transitionend', () => progress.remove(), { once: true });
  }

  refreshIcons();
  updateChatCardDownloadState(item.id);
}

function fileMetaHtml(item) {
  return `<div class="file-info">
  <div class="file-name" title="${escAttr(item.filename)}">${escHtml(item.filename)}</div>
  <div class="file-type">${fileTypeName(item.mimeType)}</div>
  <div class="file-size">${humanSize(item.size)}</div>
</div>`;
}

function imageCardHtml(item, imagePreviewUrl) {
  return `<div class="card-image"><img src="${escAttr(imagePreviewUrl)}" alt="${escAttr(item.filename || 'image')}"></div>
<div class="card-image-meta">${fileMetaHtml(item)}</div>`;
}

function videoCardHtml(item) {
  return `<div class="card-video"><video src="${escAttr(item.dataUrl)}" controls preload="metadata" playsinline></video></div>
<div class="card-image-meta">${fileMetaHtml(item)}</div>`;
}

function playableVideoCardHtml(item) {
  return item?.dataUrl && isBrowserPlayableVideo(item.mimeType) ? videoCardHtml(item) : '';
}

function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-' + item.id;
  if (item.type === 'encrypted') {
    card.hidden = true;
    return card;
  }

  let bodyHtml = '';
  let footerActions = '';

  if (item.type === 'text') {
    bodyHtml = `<div class="card-text">
  <div class="text-content" contenteditable="true" spellcheck="false">${linkify(item.content)}</div>
</div>`;
    footerActions = `<button class="btn-icon" title="Copy" type="button" data-card-action="copy"><i data-lucide="copy"></i></button>`;

  } else if (item.type === 'image' && item.thumbnailDataUrl && !item.dataUrl) {
    bodyHtml = imageCardHtml(item, item.thumbnailDataUrl);

  } else if (item.dataUrl) {
    const imagePreviewUrl = item.thumbnailDataUrl || (isBrowserViewableImage(item.mimeType) ? item.dataUrl : '');
    if (item.type === 'image' && imagePreviewUrl) {
      bodyHtml = imageCardHtml(item, imagePreviewUrl);
    } else if (isBrowserPlayableVideo(item.mimeType)) {
      bodyHtml = videoCardHtml(item);
    } else {
      bodyHtml = `<div class="card-file">${fileTypeIcon(item.mimeType)}${fileMetaHtml(item)}</div>`;
    }
    footerActions = `<button class="btn-icon" title="Download" type="button" data-card-action="download"><i data-lucide="download"></i></button>`;

  } else {
    bodyHtml = `<div class="card-file">${fileTypeIcon(item.mimeType)}${fileMetaHtml(item)}</div>`;
  }

  const addedAt = Number.isFinite(Number(item.addedAt)) ? Number(item.addedAt) : Date.now();

  card.innerHTML = `
<div class="card-body">${bodyHtml}</div>
<div class="card-footer">
  <span class="card-time" data-added-at="${addedAt}"><span class="card-time-text">${timeAgo(addedAt)}</span></span>
  ${footerActions}
  <button class="btn-icon" title="Delete" type="button" data-card-action="delete"><i data-lucide="trash-2"></i></button>
</div>`;

  bindCardEvents(card, item.id);
  return card;
}

function bindCardEvents(card, itemId) {
  const text = card.querySelector('.text-content');
  if (text) {
    text.addEventListener('input', () => onTextEdit(itemId, text));
    text.addEventListener('focus', () => onTextFocus(itemId, text));
    text.addEventListener('blur', () => onTextBlur(itemId, text));
  }
  card.querySelector('[data-card-action="copy"]')?.addEventListener('click', () => copyText(itemId));
  card.querySelector('[data-card-action="download"]')?.addEventListener('click', () => downloadItem(itemId));
  card.querySelector('[data-card-action="delete"]')?.addEventListener('click', () => deleteItem(itemId));
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
