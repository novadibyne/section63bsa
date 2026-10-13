import { createMD5, createSHA1, createSHA256 } from 'hash-wasm';

export interface HashResult {
  sha256: string;
  sha1: string;
  md5: string;
}

export const CHUNK_BYTES = 4 * 1024 * 1024;

/** Reads the blob in 4 MB chunks and computes SHA-256, SHA-1 and MD5 in one pass. */
export async function hashBlobChunked(blob: Blob, onProgress?: (fraction: number) => void): Promise<HashResult> {
  const [sha256, sha1, md5] = await Promise.all([createSHA256(), createSHA1(), createMD5()]);
  sha256.init();
  sha1.init();
  md5.init();
  const size = blob.size;
  let offset = 0;
  onProgress?.(0);
  while (offset < size) {
    const end = Math.min(offset + CHUNK_BYTES, size);
    const chunk = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
    sha256.update(chunk);
    sha1.update(chunk);
    md5.update(chunk);
    offset = end;
    onProgress?.(size ? offset / size : 1);
  }
  onProgress?.(1);
  return { sha256: sha256.digest('hex'), sha1: sha1.digest('hex'), md5: md5.digest('hex') };
}

export async function hashBytes(data: Uint8Array): Promise<HashResult> {
  const [sha256, sha1, md5] = await Promise.all([createSHA256(), createSHA1(), createMD5()]);
  sha256.init().update(data);
  sha1.init().update(data);
  md5.init().update(data);
  return { sha256: sha256.digest('hex'), sha1: sha1.digest('hex'), md5: md5.digest('hex') };
}

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const h = await createSHA256();
  return h.init().update(data).digest('hex');
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}
