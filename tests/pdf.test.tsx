import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { CertificateDocument } from '@/lib/pdf/render';
import type { CertificateContext } from '@/lib/legal/certificate-values';

export const sampleContext = (fileCount = 1): CertificateContext => ({
  evidence: { id: 'ev-1', title: 'WhatsApp chat', evidenceType: 'whatsapp_export', mannerOfProduction: 'Exported via WhatsApp', status: 'hashed', createdAt: '2026-10-13T10:00:00Z', updatedAt: '2026-10-13T10:00:00Z' },
  files: Array.from({ length: fileCount }, (_, i) => ({
    id: `f${i}`, evidenceId: 'ev-1', originalFilename: `chat-${i}.zip`, kind: 'whatsapp_export' as const, sizeBytes: 1234, detectedMime: 'application/zip',
    sha256: '78a59b5110151199e10b188bad351928ca0dcb1c0fb1e5fea4322ba7db0adf69',
    hashedAt: '2026-10-13T10:00:00Z', metadata: { summary: [] }, blobStored: true, addedAt: '2026-10-13T10:00:00Z',
    members: [{ name: '_chat.txt', sizeBytes: 524, sha256: '78a59b5110151199e10b188bad351928ca0dcb1c0fb1e5fea4322ba7db0adf69' }],
  })),
  devices: [{ id: 'd', evidenceId: 'ev-1', categories: ['mobile', 'cloud'], makeModel: 'Samsung Galaxy S23 (SM-S911B)', color: 'Black', serialNumber: 'R5CW12345', identifiers: [{ idType: 'imei', value: '490154203237518' }], otherInfo: 'Android 14; WhatsApp 2.26', createdAt: '' }],
  cert: {
    id: 'c', evidenceId: 'ev-1', version: 1, scheduleVersion: 'BSA-2023-original', hashAlgo: 'sha256', status: 'draft', createdAt: '', updatedAt: '', declarationAcknowledgedAt: 'x',
    partA: { fullName: 'Ravi Sharma', relationName: 'Suresh Sharma', addressOrEmployer: '14 MG Road, Pune 411001', date: '2026-10-13', time: '16:23', place: 'Pune', control: ['owned', 'operated'] },
    partB: { fullName: 'Dr. Neha Mehta', relationName: 'Anil Mehta', addressOrEmployer: 'Cyber Forensics Lab, Baner, Pune', designation: 'Digital Forensic Examiner', qualification: '', date: '2026-10-13', time: '16:30', place: 'Pune' },
  },
});

describe('certificate PDF', () => {
  it('renders Part A, Part B and the Hash Report on separate pages', async () => {
    const buf = await renderToBuffer(<CertificateDocument ctx={sampleContext()} draft />);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toContain('Section 63 BSA certificate');
  });
});

describe('certificate PDF with many files', () => {
  it('keeps every page renderable when Part A runs long', async () => {
    const buf = await renderToBuffer(<CertificateDocument ctx={sampleContext(6)} draft={false} />);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });
});

describe('certificate PDF for one part', () => {
  it.each([
    ['A', 'Part A only'],
    ['B', 'Part B only'],
  ] as const)('renders only Part %s and the Hash Report', async (parts, label) => {
    const ctx = sampleContext();
    const buf = await renderToBuffer(<CertificateDocument ctx={{ ...ctx, cert: { ...ctx.cert, parts } }} draft />);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toContain(label);
  });
});
