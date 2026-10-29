import { describe, expect, it } from 'vitest';
import { buildPartValues, findIssues, hashValuesText } from '@/lib/legal/certificate-values';
import type { Certificate, Device, Evidence, EvidenceFile } from '@/lib/types';

const file = (n: number): EvidenceFile => ({
  id: `f${n}`, evidenceId: 'e', originalFilename: `photo${n}.jpg`, kind: 'image', sizeBytes: 10,
  sha256: `${n}`.repeat(64).slice(0, 64), hashedAt: '', metadata: { summary: [] }, blobStored: false, addedAt: '',
});
const evidence: Evidence = { id: 'e', title: 'T', evidenceType: 'image', mannerOfProduction: 'Screenshots', status: 'hashed', createdAt: '', updatedAt: '' };
const device: Device = { id: 'd', evidenceId: 'e', categories: ['mobile', 'cloud'], makeModel: 'Samsung SM-S911B', color: 'Black', serialNumber: 'R5CW', identifiers: [{ idType: 'imei', value: '490154203237518' }], createdAt: '' };
const cert: Certificate = {
  id: 'c', evidenceId: 'e', version: 1, scheduleVersion: 'BSA-2023-original', hashAlgo: 'sha256', status: 'draft', createdAt: '', updatedAt: '',
  partA: { fullName: 'Asha Rao', relationName: 'K. Rao', addressOrEmployer: 'Pune', date: '2026-10-13', time: '14:30', place: 'Pune', control: ['owned', 'operated'] },
  partB: { fullName: 'Dr. N. Mehta', relationName: 'S. Mehta', addressOrEmployer: 'Forensics Lab', designation: 'Examiner', qualification: '', date: '2026-10-13', time: '15:00', place: 'Pune' },
  declarationAcknowledgedAt: 'x',
};

describe('certificate values', () => {
  it('fills Part A from the records', () => {
    const v = buildPartValues('A', { evidence, files: [file(1)], devices: [device], cert });
    expect(v.fields.name).toBe('Asha Rao');
    expect(v.fields.date).toBe('13/10/2026');
    expect(v.fields.identifiers).toBe('IMEI 490154203237518');
    expect(v.fields.hashValues).toBe(file(1).sha256);
    expect([...v.boxes.device]).toEqual(['mobile', 'cloud']);
    expect([...v.boxes.control]).toEqual(['owned', 'operated']);
    expect([...v.boxes.algo]).toEqual(['sha256']);
    expect(v.fields.algoOther).toBeUndefined();
  });
  it('numbers the two IMEIs of a dual-SIM phone', () => {
    const dual = { ...device, identifiers: [{ idType: 'imei' as const, value: '490154203237518' }, { idType: 'imei' as const, value: '356938035643809' }, { idType: 'mac' as const, value: 'AA:BB:CC:DD:EE:FF' }] };
    const v = buildPartValues('A', { evidence, files: [file(1)], devices: [dual], cert });
    expect(v.fields.identifiers).toBe('IMEI 1 490154203237518; IMEI 2 356938035643809; MAC AA:BB:CC:DD:EE:FF');
  });
  it('does not tick control boxes in Part B', () => {
    const v = buildPartValues('B', { evidence, files: [file(1)], devices: [device], cert });
    expect(v.boxes.control.size).toBe(0);
    expect(v.fields.name).toBe('Dr. N. Mehta');
    expect(v.signatureLines).toEqual(['Dr. N. Mehta', 'Examiner']);
  });
  it('lists several files and refers to the annexure beyond four', () => {
    const t = hashValuesText([1, 2, 3, 4, 5, 6].map(file));
    expect(t).toContain('(photo1.jpg)');
    expect(t).toContain('and 2 more, as per the Hash Report annexed');
  });
  it('reports nothing missing for a complete certificate', () => {
    expect(findIssues({ evidence, files: [file(1)], devices: [device], cert })).toEqual([]);
  });
  it('reports what is missing', () => {
    const issues = findIssues({ evidence: { ...evidence, mannerOfProduction: '' }, files: [], devices: [], cert: { ...cert, declarationAcknowledgedAt: undefined } });
    expect(issues.map((i) => i.step)).toEqual([1, 1, 2, 3]);
  });
});
