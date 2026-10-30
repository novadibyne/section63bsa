// The only module allowed to write audit events. There is deliberately no update or delete.
import { db } from '@/lib/db';
import { nowIso } from '@/lib/time';
import type { AuditAction, AuditEvent } from '@/lib/types';
import { GENESIS_HASH, computeRowHash } from './chain';

let localQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // Web Locks serialise appends across tabs; fall back to an in-page queue.
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('section63bsa-audit', fn) as Promise<T>;
  }
  const run = localQueue.then(fn, fn);
  localQueue = run.catch(() => undefined);
  return run;
}

export function appendAudit(
  action: AuditAction,
  opts: { evidenceId?: string; certificateId?: string; details?: Record<string, unknown> } = {},
): Promise<AuditEvent> {
  return withLock(async () => {
    const last = await db.auditEvents.orderBy('seq').last();
    const prevHash = last?.rowHash ?? GENESIS_HASH;
    const event: Omit<AuditEvent, 'rowHash'> = {
      action,
      evidenceId: opts.evidenceId,
      certificateId: opts.certificateId,
      details: opts.details ?? {},
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      createdAt: nowIso(),
      prevHash,
    };
    const rowHash = await computeRowHash(prevHash, event);
    const full: AuditEvent = { ...event, rowHash };
    full.seq = await db.auditEvents.add(full);
    return full;
  });
}

export const ACTION_LABEL: Record<AuditAction, string> = {
  'evidence.create': 'Evidence created',
  'evidence.update': 'Evidence updated',
  'evidence.delete': 'Evidence deleted',
  'file.add': 'File added',
  'file.hash': 'File hashed',
  'file.remove': 'File removed',
  'file.reverify': 'File re-verified',
  'file.acquisition_hash': 'Acquisition hash recorded',
  'file.observe': 'File observations generated',
  'device.save': 'Device saved',
  'device.scan': 'Device IDs read from a photo',
  'device.remove': 'Device removed',
  'certificate.create': 'Certificate version created',
  'certificate.generate': 'Draft PDF generated',
  'certificate.finalise': 'Certificate finalised',
  'certificate.download': 'PDF downloaded',
  'bundle.export': 'Case bundle exported',
  'bundle.import': 'Case bundle imported',
  'data.clear': 'Local data cleared',
};
