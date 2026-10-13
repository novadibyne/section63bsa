import Dexie, { type Table } from 'dexie';
import type { AuditEvent, Certificate, Device, Evidence, EvidenceFile, StoredPdf } from './types';

export class AppDB extends Dexie {
  evidence!: Table<Evidence, string>;
  files!: Table<EvidenceFile, string>;
  blobs!: Table<{ fileId: string; blob: Blob }, string>;
  devices!: Table<Device, string>;
  certificates!: Table<Certificate, string>;
  pdfs!: Table<StoredPdf, string>;
  auditEvents!: Table<AuditEvent, number>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('section63bsa');
    this.version(1).stores({
      evidence: 'id, status, createdAt, updatedAt',
      files: 'id, evidenceId, sha256',
      blobs: 'fileId',
      devices: 'id, evidenceId',
      certificates: 'id, evidenceId, [evidenceId+version], status',
      pdfs: 'certificateId',
      auditEvents: '++seq, evidenceId, certificateId, action, createdAt',
      settings: 'key',
    });
  }
}

export const db = new AppDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}
