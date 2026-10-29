// Reads IMEIs and serial numbers from a photo, entirely in this browser.
// Barcodes (zxing-wasm) are tried first because box labels carry them and they are exact; then the text is
// read with Tesseract OCR. Both engines are served by this site (see scripts/copy-scan-assets.mjs) and load
// only when a scan starts. The photo is never stored, hashed or sent anywhere.
import { assetPath } from '@/lib/config';
import { findDeviceIds, type BarcodeHit, type DeviceIdScan } from './parse';

export type ScanStage = 'preparing' | 'barcodes' | 'loading' | 'reading';

export interface ScanProgress {
  stage: ScanStage;
  progress?: number;
}

const absolute = (path: string) => new URL(assetPath(path), window.location.href).href;

/** Draws the photo on a canvas no larger than 2400 px. `enlarge` scales small images up, which helps OCR (not barcodes). */
function toCanvas(bmp: ImageBitmap, enlarge: boolean): HTMLCanvasElement {
  const longest = Math.max(bmp.width, bmp.height);
  const scale = longest > 2400 ? 2400 / longest : enlarge && longest < 1200 ? 1600 / longest : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Light text on a dark screen (dark mode) reads better inverted. */
function inverted(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'grayscale(1) invert(1) contrast(1.4)';
  ctx.drawImage(src, 0, 0);
  return canvas;
}

let zxingReady = false;

async function readBarcodesFrom(canvas: HTMLCanvasElement): Promise<BarcodeHit[]> {
  const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
  if (!zxingReady) {
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? absolute('vendor/zxing/zxing_reader.wasm') : prefix + path) },
    });
    zxingReady = true;
  }
  const image = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  const results = await readBarcodes(image, { tryHarder: true, maxNumberOfSymbols: 12 });
  return results
    .filter((r) => r.isValid && r.text)
    .sort((a, b) => a.position.topLeft.y - b.position.topLeft.y)
    .map((r) => ({ text: r.text, format: r.format }));
}

export async function scanDeviceIds(photo: Blob, onProgress: (p: ScanProgress) => void): Promise<DeviceIdScan & { textRead: boolean }> {
  onProgress({ stage: 'preparing' });
  const bmp = await createImageBitmap(photo);
  const canvas = toCanvas(bmp, true);

  onProgress({ stage: 'barcodes' });
  let barcodes: BarcodeHit[] = [];
  try {
    barcodes = await readBarcodesFrom(toCanvas(bmp, false));
  } catch {
    // Barcodes are a bonus; carry on with the text.
  } finally {
    bmp.close();
  }

  onProgress({ stage: 'loading', progress: 0 });
  const { createWorker, OEM } = await import('tesseract.js');
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: absolute('vendor/tesseract/worker.min.js'),
    corePath: absolute('vendor/tesseract/core'),
    langPath: absolute('vendor/tesseract/lang'),
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) =>
      onProgress(m.status === 'recognizing text' ? { stage: 'reading', progress: m.progress } : { stage: 'loading', progress: m.progress }),
  });
  try {
    let text = (await worker.recognize(canvas)).data.text;
    let found = findDeviceIds({ text, barcodes });
    if (!found.imeis.length && !found.serials.length) {
      text += `\n${(await worker.recognize(inverted(canvas))).data.text}`;
      found = findDeviceIds({ text, barcodes });
    }
    return { ...found, textRead: text.trim().length > 0 };
  } finally {
    await worker.terminate();
  }
}
