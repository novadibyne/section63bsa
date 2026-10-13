import { hashBlobChunked, type HashResult } from './hash-core';

export type { HashResult };

/**
 * Hashes a file in a Web Worker so the page stays responsive.
 * Falls back to the main thread if workers are unavailable.
 */
export function hashFile(blob: Blob, onProgress?: (fraction: number) => void): Promise<HashResult> {
  let worker: Worker | undefined;
  try {
    worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return hashBlobChunked(blob, onProgress);
  }
  return new Promise<HashResult>((resolve, reject) => {
    const w = worker!;
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; value?: number; result?: HashResult; message?: string };
      if (msg.type === 'progress') onProgress?.(msg.value ?? 0);
      else if (msg.type === 'done') {
        w.terminate();
        resolve(msg.result!);
      } else if (msg.type === 'error') {
        w.terminate();
        reject(new Error(msg.message));
      }
    };
    w.onerror = () => {
      w.terminate();
      hashBlobChunked(blob, onProgress).then(resolve, reject);
    };
    w.postMessage({ blob });
  });
}

export function normaliseHash(value: string): string {
  return value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
}

export function guessAlgoFromLength(hex: string): 'md5' | 'sha1' | 'sha256' | undefined {
  const n = normaliseHash(hex).length;
  return n === 32 ? 'md5' : n === 40 ? 'sha1' : n === 64 ? 'sha256' : undefined;
}
