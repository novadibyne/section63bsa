import { describe, expect, it } from 'vitest';
import { canonicalJSON, computeRowHash, GENESIS_HASH, verifyChain } from '@/lib/audit/chain';
import type { AuditEvent } from '@/lib/types';

async function chain(n: number): Promise<AuditEvent[]> {
  const rows: AuditEvent[] = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < n; i++) {
    const base = { action: 'file.hash' as const, evidenceId: 'e1', details: { i, nested: { b: 2, a: 1 } }, userAgent: 'test', createdAt: `2026-10-13T10:0${i}:00.000Z`, prevHash: prev };
    const rowHash = await computeRowHash(prev, base);
    rows.push({ ...base, seq: i + 1, rowHash });
    prev = rowHash;
  }
  return rows;
}

describe('audit chain', () => {
  it('serialises keys in a stable order', () => {
    expect(canonicalJSON({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"x":0,"y":1}]},"b":1}');
  });
  it('verifies an untouched chain', async () => {
    expect(await verifyChain(await chain(5))).toEqual({ ok: true, count: 5 });
  });
  it('detects an edited entry', async () => {
    const rows = await chain(5);
    rows[2].details = { i: 99 };
    const r = await verifyChain(rows);
    expect(r.ok).toBe(false);
    expect(r.brokenAtSeq).toBe(3);
  });
  it('detects a deleted entry', async () => {
    const rows = await chain(5);
    rows.splice(1, 1);
    const r = await verifyChain(rows);
    expect(r.ok).toBe(false);
    expect(r.brokenAtSeq).toBe(3);
  });
});
