// Writes THIRD_PARTY_LICENSES.md: every open-source package the app ships to visitors, with its licence,
// and separately the tools only used to build and test it.
//
// It builds the app once with browser source maps (LICENSE_SCAN=1) and reads which packages from
// node_modules ended up in the bundle, then adds every dependency of the app with its own dependencies
// and the files copied into public/vendor/ (the scan engines, see scripts/copy-scan-assets.mjs).
//
//   npm run licenses            build, scan and write the file
//   npm run licenses -- --check also exit with an error if a shipped package is not permissively licensed
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')).packages;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** Licences that allow free commercial use and only ask for the notice to be kept. */
const PERMISSIVE = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'OFL-1.1', 'Zlib', 'CC0-1.0', 'Unlicense', '(MIT AND Zlib)', '(MIT OR CC0-1.0)', '(MIT OR Apache-2.0)']);
/** Dual licences where the app takes the permissive option. */
const CHOSEN = { '(MIT OR GPL-3.0-or-later)': 'MIT' };

const USED_FOR = {
  next: 'Web framework (static site)',
  react: 'User interface',
  'react-dom': 'User interface',
  '@react-pdf/renderer': 'Builds the certificate PDF in the browser',
  'pdf-lib': 'Reads details of PDF evidence files',
  'hash-wasm': 'SHA-256 hashing of evidence files',
  exifr: 'Reads photo details (EXIF)',
  'music-metadata': 'Reads audio and video details',
  'file-type': 'Detects the real type of a file',
  jszip: 'WhatsApp .zip exports and case bundles',
  dexie: 'Stores records in the browser (IndexedDB)',
  'dexie-react-hooks': 'Stores records in the browser (IndexedDB)',
  'date-fns': 'Dates in DD/MM/YYYY and IST',
  'date-fns-tz': 'Dates in DD/MM/YYYY and IST',
  'tesseract.js': 'Reads IMEI / serial text from a photo (OCR)',
  'zxing-wasm': 'Reads barcodes on phone box labels',
  '@tesseract.js-data/eng': 'English data for the text reader',
  'lucide-react': 'Icons',
  sonner: 'Notifications',
  clsx: 'Styling helpers',
  'tailwind-merge': 'Styling helpers',
  'class-variance-authority': 'Styling helpers',
  '@fontsource-variable/inter': 'Font (Inter)',
  '@fontsource-variable/plus-jakarta-sans': 'Font (Plus Jakarta Sans)',
  '@fontsource-variable/jetbrains-mono': 'Font (JetBrains Mono)',
  '@fontsource-variable/source-serif-4': 'Font (Source Serif 4)',
};

const nameOf = (key) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);

function licenceOf(key) {
  const declared = lock[key]?.license;
  if (declared && !/^SEE LICENSE/i.test(declared)) return declared;
  // A few packages only say it in their LICENSE file.
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    const p = join(root, key, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    if (/^\s*(The )?MIT License/i.test(text)) return 'MIT';
    if (/free and unencumbered software released into the public domain/i.test(text)) return 'Unlicense';
  }
  return declared ?? 'UNKNOWN';
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The lockfile keys of a package and everything it depends on at runtime. */
function withDependencies(key, seen = new Set()) {
  if (!lock[key] || seen.has(key)) return seen;
  seen.add(key);
  for (const dep of Object.keys(lock[key].dependencies ?? {})) {
    // Node resolution: look in the package's own node_modules first, then up the tree.
    let base = key;
    for (;;) {
      const candidate = `${base}/node_modules/${dep}`;
      if (lock[candidate]) {
        withDependencies(candidate, seen);
        break;
      }
      const up = base.lastIndexOf('/node_modules/');
      if (up < 0) {
        withDependencies(`node_modules/${dep}`, seen);
        break;
      }
      base = base.slice(0, up);
    }
  }
  return seen;
}

// 1. Build once with browser source maps.
if (!process.argv.includes('--no-build')) {
  const r = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, LICENSE_SCAN: '1' },
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 2. Packages whose code is in the browser bundle.
const shipped = new Set();
const maps = walk(join(root, '.next', 'static')).filter((f) => f.endsWith('.js.map'));
if (!maps.length) {
  console.error('No source maps found in .next/static. Run without --no-build.');
  process.exit(1);
}
for (const map of maps) {
  for (const source of JSON.parse(readFileSync(map, 'utf8')).sources ?? []) {
    const i = source.indexOf('node_modules/');
    if (i < 0) continue;
    const m = /^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*/.exec(source.slice(i));
    if (m && lock[m[0]]) shipped.add(m[0]);
  }
}
// Packages that ship their own source maps (lucide-react, for one) show up under their original paths, and fonts
// arrive through CSS, so also count every direct dependency and everything it depends on. Next.js is counted
// itself, but not its dependencies: those are build tools (bundler, image resizer) unless the maps found them.
for (const dep of Object.keys(pkg.dependencies)) {
  if (dep === 'next') shipped.add('node_modules/next');
  else for (const k of withDependencies(`node_modules/${dep}`)) shipped.add(k);
}

// 3. Files copied into public/vendor/ and served as they are.
const VENDOR = [
  { file: 'vendor/tesseract/worker.min.js', key: 'node_modules/tesseract.js', note: 'Text reader worker; bundles the tesseract.js dependencies listed above' },
  { file: 'vendor/tesseract/core/*.wasm.js', key: 'node_modules/tesseract.js-core', note: 'Tesseract OCR engine (Apache-2.0) with Leptonica (BSD-2-Clause style), compiled to WebAssembly' },
  { file: 'vendor/tesseract/lang/eng.traineddata.gz', key: 'node_modules/@tesseract.js-data/eng', note: 'English model from tesseract-ocr/tessdata_best, which is Apache-2.0; the npm package is MIT' },
  { file: 'vendor/zxing/zxing_reader.wasm', key: 'node_modules/zxing-wasm', note: 'Barcode reader compiled from zxing-cpp (Apache-2.0)' },
];
for (const v of VENDOR) for (const k of withDependencies(v.key)) shipped.add(k);

// 4. Everything else in the lockfile is only used to build or test the app.
const notShipped = Object.keys(lock).filter((k) => k && !shipped.has(k));

const row = (k) => {
  const name = nameOf(k);
  const declared = licenceOf(k);
  const lic = CHOSEN[declared] ? `${declared}, used under ${CHOSEN[declared]}` : declared;
  return { name, version: lock[k].version, licence: lic, effective: CHOSEN[declared] ?? declared, direct: k === `node_modules/${name}` && name in pkg.dependencies };
};
const shippedRows = [...shipped].map(row).sort((a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name));
const otherRows = notShipped.map(row).sort((a, b) => a.name.localeCompare(b.name));
const flagged = shippedRows.filter((r) => !PERMISSIVE.has(r.effective));

const count = (rows) =>
  Object.entries(rows.reduce((m, r) => ((m[r.effective] = (m[r.effective] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `${l} (${n})`)
    .join(', ');
const npm = (name) => `[${name}](https://www.npmjs.com/package/${name})`;

const today = new Date().toISOString().slice(0, 10);
const md = `# Third-party licences

Legal Hashed is built with open-source software. This file lists every package whose code is, or may be, sent to people's browsers when they use the app, with its licence. Tools used only to build and test the app are listed separately at the end.

Generated by \`npm run licenses\` on ${today}. The shipped list combines what the production build's source maps show and every dependency of the app with everything it depends on, so nothing that reaches visitors is missed. It may include a few helper packages that a library only uses outside the browser.

## Summary

- **${shippedRows.length} packages are shipped in the app.** Licences: ${count(shippedRows)}.
- ${flagged.length ? `**${flagged.length} need attention**: see the section below.` : '**All of them are permissive licences** that allow free commercial use. They only ask that the copyright and licence notices are kept, which this file and the licence comments kept in the bundled code do.'}
- **No GPL, LGPL or AGPL code is shipped.** jszip is offered under "MIT or GPL-3.0"; the app uses it under MIT.
- **Fonts** (Inter, Plus Jakarta Sans, JetBrains Mono, Source Serif 4) are under the SIL Open Font License 1.1, which allows bundling them in an app, including a commercial one. They may not be sold on their own.
- **Apache-2.0** packages (for example Tesseract, dexie, zxing-cpp): keep their licence and any NOTICE file when redistributing. The licence files are copied next to the scan engines in \`public/vendor/\`.
- **Build-only tools are not shipped.** Two of them have non-permissive licences: \`sharp\` / \`libvips\` (LGPL-3.0), which Next.js uses to resize images on a server (this static site turns that off and never includes it), and \`caniuse-lite\` (CC-BY-4.0), browser-support data used at build time.
${flagged.length ? `\n## Needs attention\n\n| Package | Version | Licence |\n|---|---|---|\n${flagged.map((r) => `| ${npm(r.name)} | ${r.version} | ${r.licence} |`).join('\n')}\n` : ''}
## Shipped in the app

Direct dependencies first (with what they are used for), then the packages they bring in.

| Package | Version | Licence | Used for |
|---|---|---|---|
${shippedRows.map((r) => `| ${npm(r.name)} | ${r.version} | ${r.licence} | ${r.direct ? (USED_FOR[r.name] ?? '') : ''} |`).join('\n')}

## Files served from \`public/vendor/\`

These are copied from the packages above at build time (\`scripts/copy-scan-assets.mjs\`) so the site serves them itself instead of loading them from a CDN.

| File | From | Licence | Notes |
|---|---|---|---|
${VENDOR.map((v) => `| \`${v.file}\` | ${npm(nameOf(v.key))} ${lock[v.key].version} | ${licenceOf(v.key)} | ${v.note} |`).join('\n')}

## Build and test tools (not shipped)

Used on the developer's computer or in GitHub Actions only. Licences: ${count(otherRows)}.

<details>
<summary>All ${otherRows.length} packages</summary>

| Package | Version | Licence |
|---|---|---|
${otherRows.map((r) => `| ${npm(r.name)} | ${r.version} | ${r.licence} |`).join('\n')}

</details>
`;

writeFileSync(join(root, 'THIRD_PARTY_LICENSES.md'), md);
// The scan build put source maps in out/; remove it so it can't be deployed by mistake.
rmSync(join(root, 'out'), { recursive: true, force: true });
console.log(`THIRD_PARTY_LICENSES.md: ${shippedRows.length} shipped (${count(shippedRows)}), ${otherRows.length} build-only.`);
console.log('out/ was removed. Run `npm run build` to build the site again.');
if (flagged.length) {
  console.error(`Not permissive: ${flagged.map((r) => `${r.name} (${r.licence})`).join(', ')}`);
  if (process.argv.includes('--check')) process.exit(1);
}
