import { describe, expect, it } from 'vitest';
import { certificateLabels, courtType } from '@/lib/legal/certificate-summary';
import { makerOf } from '@/lib/device-scan/parse';
import { cleanLabels } from '@/lib/telemetry';
import type { Certificate, Device, Evidence, EvidenceFile } from '@/lib/types';

const file = (n: number, kind: EvidenceFile['kind'], extra: Partial<EvidenceFile> = {}): EvidenceFile => ({
  id: `f${n}`, evidenceId: 'e', originalFilename: `Ravi Sharma chat ${n}.zip`, kind, sizeBytes: 1_250_000,
  sha256: '78a59b5110151199e10b188bad351928ca0dcb1c0fb1e5fea4322ba7db0adf69', hashedAt: '', metadata: {}, blobStored: false, addedAt: '', ...extra,
});
const evidence: Evidence = {
  id: 'e', title: 'WhatsApp chat with Ravi Sharma', evidenceType: 'whatsapp_export', mannerOfProduction: 'Exported from WhatsApp',
  courtName: 'Chief Judicial Magistrate, Pune', caseNumber: 'RCC 1234/2026', status: 'hashed', createdAt: '', updatedAt: '',
};
const device: Device = {
  id: 'd', evidenceId: 'e', categories: ['mobile', 'cloud'], makeModel: 'Galaxy S23 (SM-S911B/DS)', color: 'Black', serialNumber: 'R5CW12345',
  identifiers: [{ idType: 'imei', value: '490154203237518' }, { idType: 'mac', value: '' }], createdAt: '',
};
const cert: Certificate = {
  id: 'c', evidenceId: 'e', version: 2, scheduleVersion: 'BSA-2023-original', hashAlgo: 'sha256', status: 'draft', createdAt: '', updatedAt: '',
  parts: 'both', includeObservations: true,
  partA: { fullName: 'Asha Rao', relationName: 'K. Rao', addressOrEmployer: '12 MG Road, Pune', date: '2026-10-13', time: '14:30', place: 'Pune', control: ['owned', 'operated'] },
  partB: { fullName: 'Dr. N. Mehta', relationName: 'S. Mehta', addressOrEmployer: 'Forensics Lab', designation: 'Examiner', qualification: 'M.Sc.', date: '2026-10-13', time: '15:00', place: 'Pune' },
  declarationAcknowledgedAt: 'x',
};
const files = [
  file(1, 'whatsapp_export', {
    members: [{ name: 'IMG-1.jpg', sizeBytes: 1, sha256: 'a' }, { name: 'IMG-2.jpg', sizeBytes: 1, sha256: 'b' }],
    observations: { rules: '1.0', checkedAt: '', items: [{ id: 'x', check: '', status: 'noted', finding: '', note: '', method: '' }] },
  }),
  file(2, 'image', { acquisitionHash: 'abc', acquisitionHashMatch: true }),
];

describe('what kind of certificate a PDF is', () => {
  it('describes the certificate with kinds and counts', () => {
    expect(certificateLabels({ evidence, files, devices: [device], cert })).toEqual({
      certificate_id: 'c',
      parts: 'both',
      version: 2,
      evidence_type: 'whatsapp_export',
      file_count: 2,
      file_kinds: 'image+whatsapp_export',
      archive_files: 2,
      total_kb: 2441,
      device_count: 1,
      device_types: 'cloud+mobile',
      device_makers: 'samsung',
      id_types: 'imei',
      control: 'operated+owned',
      court_type: 'magistrate',
      case_number_given: true,
      manner_given: true,
      acquisition_hash: 'match',
      observations_annexure: true,
      observations_noted: 1,
      complete: true,
    });
  });

  it('never carries anything typed into the app or read from the files', () => {
    const sent = JSON.stringify(cleanLabels(certificateLabels({ evidence, files, devices: [device], cert })));
    for (const secret of ['Ravi', 'Sharma', 'Asha', 'Mehta', 'MG Road', 'Pune', 'RCC', '1234', '490154203237518', 'R5CW', 'SM-S911B', 'Galaxy', '78a59b51', 'IMG-1', 'Exported']) {
      expect(sent).not.toContain(secret);
    }
  });

  it('leaves out Part A details when only Part B is made', () => {
    const labels = certificateLabels({ evidence, files, devices: [], cert: { ...cert, parts: 'B' } });
    expect(labels.control).toBeUndefined();
    expect(labels).toMatchObject({ parts: 'B', device_count: 0, device_types: 'none', device_makers: 'none', id_types: 'none' });
  });

  it('names only the kind of court', () => {
    expect(courtType('Hon’ble High Court of Bombay')).toBe('high_court');
    expect(courtType('Family Court, Bandra')).toBe('family_court');
    expect(courtType('Addl. Sessions Judge, Pune')).toBe('sessions_court');
    expect(courtType('Civil Judge (Sr. Div.), Pune')).toBe('civil_court');
    expect(courtType('JMFC, Shivajinagar')).toBe('magistrate');
    expect(courtType('District Consumer Disputes Redressal Commission')).toBe('consumer_commission');
    expect(courtType('Lok Adalat')).toBe('other');
    expect(courtType('  ')).toBe('not_given');
  });

  it('finds the maker in a make & model', () => {
    expect(makerOf('Samsung Galaxy S23')).toBe('samsung');
    expect(makerOf('iPhone 14 Pro')).toBe('apple');
    expect(makerOf('Redmi Note 12')).toBe('xiaomi');
    expect(makerOf('RMX3741')).toBe('realme');
    expect(makerOf('Dell Latitude 5420')).toBe('dell');
    expect(makerOf('MacBook Air M2')).toBe('apple');
    expect(makerOf('Hikvision DS-7608')).toBe('hikvision');
    expect(makerOf('CP Plus DVR')).toBe('cp_plus');
    expect(makerOf('Unknown tablet')).toBeUndefined();
  });
});
