import { createSHA256 } from 'hash-wasm';

export interface HashResult {
  sha256: string;
}

export const CHUNK_BYTES = 4 * 1024 * 1024;

/** Reads the blob in 4 MB chunks and computes its SHA-256. */
export async function hashBlobChunked(blob: Blob, onProgress?: (fraction: number) => void): Promise<HashResult> {
  const sha256 = await createSHA256();
  sha256.init();
  const size = blob.size;
  let offset = 0;
  onProgress?.(0);
  while (offset < size) {
    const end = Math.min(offset + CHUNK_BYTES, size);
    sha256.update(new Uint8Array(await blob.slice(offset, end).arrayBuffer()));
    offset = end;
    onProgress?.(size ? offset / size : 1);
  }
  onProgress?.(1);
  return { sha256: sha256.digest('hex') };
}

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const h = await createSHA256();
  return h.init().update(data).digest('hex');
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}
