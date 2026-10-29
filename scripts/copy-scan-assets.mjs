// Copies the barcode and text-reading engines into public/vendor/ so the site serves them itself.
// Left alone, tesseract.js and zxing-wasm download these files from a CDN; the Content-Security-Policy
// (connect-src 'self') blocks that, and the app must never depend on another server anyway.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (p) => join(root, 'node_modules', p);
const out = join(root, 'public', 'vendor');

const files = [
  // tesseract.js: the worker script, the LSTM-only engine builds (it picks one by CPU features) and English data.
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js/LICENSE.md', 'tesseract/LICENSE-tesseract.js.md'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/LICENSE', 'tesseract/core/LICENSE'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'tesseract/lang/eng.traineddata.gz'],
  // zxing-wasm: the reader-only WebAssembly build.
  ['zxing-wasm/dist/reader/zxing_reader.wasm', 'zxing/zxing_reader.wasm'],
  ['zxing-wasm/LICENSE', 'zxing/LICENSE'],
];

rmSync(out, { recursive: true, force: true });
for (const [from, to] of files) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(nm(from), dest);
}
console.log(`copy-scan-assets: ${files.length} files → public/vendor/`);
