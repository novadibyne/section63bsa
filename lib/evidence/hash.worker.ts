/// <reference lib="webworker" />
import { hashBlobChunked } from './hash-core';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<{ blob: Blob }>) => {
  try {
    let last = 0;
    const result = await hashBlobChunked(e.data.blob, (p) => {
      if (p - last >= 0.01 || p === 1) {
        last = p;
        self.postMessage({ type: 'progress', value: p });
      }
    });
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
