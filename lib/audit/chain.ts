import { sha256Text } from '@/lib/evidence/hash-core';
import type { AuditEvent } from '@/lib/types';

export const GENESIS_HASH = '0'.repeat(64);

/** JSON with object keys sorted recursively, so the same data always hashes the same way. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`)
    .join(',')}}`;
}

type HashedFields = Pick<AuditEvent, 'action' | 'evidenceId' | 'certificateId' | 'details' | 'userAgent' | 'createdAt'>;

export function hashedPayload(e: HashedFields): HashedFields {
  return {
    action: e.action,
    evidenceId: e.evidenceId,
    certificateId: e.certificateId,
    details: e.details,
    userAgent: e.userAgent,
    createdAt: e.createdAt,
  };
}

export async function computeRowHash(prevHash: string, e: HashedFields): Promise<string> {
  return sha256Text(prevHash + canonicalJSON(hashedPayload(e)));
}

export interface ChainCheck {
  ok: boolean;
  count: number;
  brokenAtSeq?: number;
  reason?: string;
}

/** Recomputes every row hash in order. Any edited, inserted or reordered row breaks the chain. */
export async function verifyChain(rows: AuditEvent[]): Promise<ChainCheck> {
  let prev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prevHash !== prev) return { ok: false, count: rows.length, brokenAtSeq: row.seq, reason: 'Link to previous entry does not match' };
    const expected = await computeRowHash(prev, row);
    if (expected !== row.rowHash) return { ok: false, count: rows.length, brokenAtSeq: row.seq, reason: 'Entry content was changed' };
    prev = row.rowHash;
  }
  return { ok: true, count: rows.length };
}
