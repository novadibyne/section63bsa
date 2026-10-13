import { describe, expect, it } from 'vitest';
import { hashBlobChunked, hashBytes, CHUNK_BYTES } from '@/lib/evidence/hash-core';
import { guessAlgoFromLength, normaliseHash } from '@/lib/evidence/hashing';

const abc = new TextEncoder().encode('abc');

describe('hashing', () => {
  it('matches the standard test vectors for "abc"', async () => {
    const h = await hashBytes(abc);
    expect(h.sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(h.sha1).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(h.md5).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('matches the standard values for an empty file', async () => {
    const h = await hashBlobChunked(new Blob([]));
    expect(h.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(h.md5).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('gives the same result when a file spans several chunks', async () => {
    const big = new Uint8Array(CHUNK_BYTES * 2 + 12345).map((_, i) => (i * 31) % 251);
    const progress: number[] = [];
    const chunked = await hashBlobChunked(new Blob([big]), (p) => progress.push(p));
    expect(chunked).toEqual(await hashBytes(big));
    expect(progress.at(-1)).toBe(1);
  });

  it('recognises pasted hashes by length', () => {
    expect(guessAlgoFromLength('900150983CD24FB0D6963F7D28E17F72')).toBe('md5');
    expect(guessAlgoFromLength('a9993e36 4706816a ba3e2571 7850c26c 9cd0d89d')).toBe('sha1');
    expect(guessAlgoFromLength('x'.repeat(10))).toBeUndefined();
    expect(normaliseHash(' AB:CD ')).toBe('abcd');
  });
});
