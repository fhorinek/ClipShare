/* The approved file-exchange mark is authored in static/logo-mark.svg.
   Regenerate its logo, favicon and installable icons with npm run build:branding. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const directory = path.resolve(__dirname, '../static');

function svg(viewBox, contents) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="ClipShare">\n${contents}\n</svg>\n`;
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, index) => {
    const position = 6 + index * 16;
    header[position] = header[position + 1] = size < 256 ? size : 0;
    header.writeUInt16LE(1, position + 4);
    header.writeUInt16LE(32, position + 6);
    header.writeUInt32LE(bytes.length, position + 8);
    header.writeUInt32LE(offset, position + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(image => image.bytes)]);
}

(async () => {
  const source = await fs.readFile(path.join(directory, 'logo-mark.svg'), 'utf8');
  const mark = source.match(/<g id="file-exchange">[\s\S]*<\/g>/)?.[0];
  const colors = source.match(/<style>[\s\S]*?<\/style>/)?.[0];
  if (!mark || !colors) throw Error('The source mark must contain file-exchange geometry and colors.');
  const logo = svg('0 0 760 168', `${colors}
  <style>.wordmark{fill:#202124}@media(prefers-color-scheme:dark){.wordmark{fill:#fff}}</style>
  <g transform="translate(2 6) scale(.58)">${mark}</g>
  <text class="wordmark" x="238" y="118" font-family="Arial, sans-serif" font-size="104" font-weight="700" letter-spacing="-4">Clip<tspan fill="#1a73e8">Share</tspan></text>`);
  const icon = maskable => svg('0 0 512 512', `  <style>.file-one{fill:#fff}.file-two{fill:#2584ff}</style>
  <rect width="512" height="512"${maskable ? '' : ' rx="112"'} fill="#102e62"/>
  <g transform="${maskable ? 'translate(97.76 144.2) scale(.86)' : 'translate(72 126)'}">${mark}</g>`);
  const regular = icon(false), maskable = icon(true);
  await fs.writeFile(path.join(directory, 'logo.svg'), logo);
  await fs.writeFile(path.join(directory, 'icon.svg'), regular);
  await fs.writeFile(path.join(directory, 'icon-maskable.svg'), maskable);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage();
    const favicons = [];
    for (const [name, size, vector] of [
      ['favicon-16.png', 16, regular], ['favicon-32.png', 32, regular],
      ['icon-192.png', 192, regular], ['icon-512.png', 512, regular],
      ['icon-maskable-192.png', 192, maskable], ['icon-maskable-512.png', 512, maskable],
      ['apple-touch-icon.png', 180, maskable],
    ]) {
      const png = await page.evaluate(async ({ vector, size }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(vector);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { vector, size });
      const bytes = Buffer.from(png, 'base64');
      await fs.writeFile(path.join(directory, name), bytes);
      if (size === 16 || size === 32) favicons.push({ size, bytes });
    }
    await fs.writeFile(path.join(directory, 'favicon.ico'), ico(favicons));
  } finally {
    await browser.close();
  }
  console.log('Built the vector logo, favicon, Apple touch icon, and regular/maskable PWA icons.');
})().catch(error => { console.error(error); process.exitCode = 1; });
