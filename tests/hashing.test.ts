import { describe, expect, it } from 'vitest';
import { hashBlobChunked, sha256Bytes, CHUNK_BYTES } from '@/lib/evidence/hash-core';
import { isSha256Hex, normaliseHash } from '@/lib/evidence/hashing';

describe('SHA-256 hashing', () => {
  it('matches the FIPS 180-4 test vector for "abc"', async () => {
    expect(await sha256Bytes(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the standard value for an empty file', async () => {
    const h = await hashBlobChunked(new Blob([]));
    expect(h).toEqual({ sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' });
  });

  it('gives the same result when a file spans several chunks', async () => {
    const big = new Uint8Array(CHUNK_BYTES * 2 + 12345).map((_, i) => (i * 31) % 251);
    const progress: number[] = [];
    const chunked = await hashBlobChunked(new Blob([big]), (p) => progress.push(p));
    expect(chunked.sha256).toBe(await sha256Bytes(big));
    expect(progress.at(-1)).toBe(1);
  });

  it('accepts only SHA-256 values when one is pasted', () => {
    expect(isSha256Hex('BA7816BF 8F01CFEA 414140DE 5DAE2223 B00361A3 96177A9C B410FF61 F20015AD')).toBe(true);
    expect(isSha256Hex('900150983cd24fb0d6963f7d28e17f72')).toBe(false); // an MD5
    expect(isSha256Hex('a9993e364706816aba3e25717850c26c9cd0d89d')).toBe(false); // a SHA-1
    expect(normaliseHash(' AB:CD ')).toBe('abcd');
  });
});
