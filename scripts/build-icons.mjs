// Draws the favicon, app icons and the social sharing image from the mark in lib/brand.ts.
// Run after changing the mark or the name: npm run icons (uses Playwright's Chromium; writes into public/).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { BRAND_GREEN, BRAND_NAVY, markSvg } from '../lib/brand.ts';

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
const pub = (p) => join(root, 'public', p);
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(require.resolve(`${pkg}/package.json`), '..', 'files', file)).toString('base64')}`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();

/** Renders HTML at a size; transparent unless the HTML paints a background. */
async function shoot(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
  if (file) {
    writeFileSync(file, png);
    console.log('wrote', file.replace(root + '/', ''));
  }
  return png;
}

/** A .ico holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size % 256, 0);
    e.writeUInt8(size % 256, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}
const icon = (svg, size, file) => shoot(`<img src="${dataUri(svg)}" width="${size}" height="${size}" style="display:block">`, size, size, file);

mkdirSync(pub('icons'), { recursive: true });
writeFileSync(pub('favicon.svg'), markSvg());
console.log('wrote public/favicon.svg');
const icoSizes = [16, 32, 48];
const icoPngs = [];
for (const size of icoSizes) icoPngs.push({ size, png: await icon(markSvg(), size, size === 48 ? pub('icons/icon-48.png') : null) });
writeFileSync(pub('favicon.ico'), ico(icoPngs));
console.log('wrote public/favicon.ico');
await icon(markSvg(), 192, pub('icons/icon-192.png'));
await icon(markSvg(), 512, pub('icons/icon-512.png'));
// Android crops maskable icons to a circle or squircle, and iOS rounds the corners itself: fill the square.
await icon(markSvg({ tile: 'square', scale: 0.78 }), 512, pub('icons/icon-maskable-512.png'));
await icon(markSvg({ tile: 'square', scale: 0.9 }), 180, pub('icons/apple-touch-icon.png'));

// Social sharing image (Open Graph / Twitter), 1200 × 630.
const digest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
await shoot(
  `<style>
    @font-face { font-family: Jakarta; src: url(${font('@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2')}); font-weight: 200 800; }
    @font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2')}); font-weight: 100 900; }
    @font-face { font-family: Mono; src: url(${font('@fontsource-variable/jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}); font-weight: 100 800; }
  </style>
  <div style="position:relative;width:1200px;height:630px;overflow:hidden;background:${BRAND_NAVY};color:#fff;font-family:Inter">
    <div style="position:absolute;right:-40px;top:40px;width:560px;height:186px;overflow:hidden;font:500 30px/1.55 Mono;color:${BRAND_GREEN};opacity:.13;word-break:break-all">${digest}${digest}${digest}</div>
    <div style="position:absolute;left:84px;top:88px;display:flex;align-items:center;gap:22px">
      <img src="${dataUri(markSvg())}" width="104" height="104" style="border-radius:30px;box-shadow:0 0 0 2px rgba(255,255,255,.18)">
      <span style="font:800 44px Jakarta;letter-spacing:-.02em">Legal Hashed</span>
    </div>
    <div style="position:absolute;left:84px;top:252px;width:900px">
      <div style="font:700 20px Inter;letter-spacing:.14em;color:${BRAND_GREEN}">BHARATIYA SAKSHYA ADHINIYAM, 2023</div>
      <div style="margin-top:14px;font:800 64px/1.05 Jakarta;letter-spacing:-.025em">Section 63 BSA certificate generator</div>
      <div style="margin-top:22px;font:500 27px/1.4 Inter;color:#c9d2e6">Part A, Part B and the SHA-256 hash report for electronic evidence, made in your browser. Free, and nothing is uploaded.</div>
    </div>
    <div style="position:absolute;left:84px;bottom:56px;font:700 26px Inter;color:${BRAND_GREEN}">legalhashed.com</div>
  </div>`,
  1200,
  630,
  pub('og-image.png'),
);

await browser.close();
