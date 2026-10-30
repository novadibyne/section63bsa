// PDFs: changes saved after the file was first written, creation and change dates, and digital signatures.
import { formatIst } from '@/lib/time';
import { quote } from './bytes';
import type { Observation } from './types';

export interface PdfStructure {
  /** Revisions appended after the PDF was first written (incremental updates). */
  laterRevisions: number;
  linearised: boolean;
  signatures: { coversTo: number; signedAt?: string }[];
  /** Bytes after the end of the last signature's range, ignoring trailing whitespace. */
  bytesAfterLastSignature: number;
}

/** Reads the PDF's revision and signature structure from its text (Latin-1, one character per byte). */
export function pdfStructure(text: string): PdfStructure {
  const linearised = /\/Linearized\s/.test(text.slice(0, 2048));
  const startxrefs = (text.match(/startxref\s/g) ?? []).length;
  // A linearised ("fast web view") file has one extra cross-reference section for its first page.
  const laterRevisions = Math.max(0, startxrefs - 1 - (linearised ? 1 : 0));
  const signatures: PdfStructure['signatures'] = [];
  for (const m of text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)) {
    const around = text.slice(Math.max(0, m.index! - 3000), m.index! + 3000);
    const when = /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(around);
    signatures.push({
      coversTo: Number(m[3]) + Number(m[4]),
      signedAt: when ? `${when[3]}/${when[2]}/${when[1]} ${when[4]}:${when[5]}` : undefined,
    });
  }
  const end = text.replace(/\s+$/, '').length;
  const lastCovered = signatures.length ? Math.max(...signatures.map((s) => s.coversTo)) : 0;
  return { laterRevisions, linearised, signatures, bytesAfterLastSignature: signatures.length ? Math.max(0, end - lastCovered) : 0 };
}

const STRUCTURE_METHOD =
  'Counted the PDF’s cross-reference sections (one per saved revision, allowing for “fast web view” files) and read each signature’s /ByteRange. Repeat with: qpdf --show-xref <file>, or pdfsig <file>.';

export function pdfRevisions(s: PdfStructure): Observation {
  const base = { id: 'pdf.revisions', check: 'Changes saved after the PDF was first written', method: STRUCTURE_METHOD };
  if (s.laterRevisions > 0) {
    return {
      ...base,
      status: 'noted',
      finding: `The PDF has ${s.laterRevisions} later revision${s.laterRevisions === 1 ? '' : 's'} appended after it was first written.`,
      note: 'Software appends a revision whenever a PDF is changed and saved without being rewritten: filling in a form, adding a signature or a comment, or editing its content. The earlier versions usually remain inside the file, and an examiner can extract each one to see what changed.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: 'The PDF holds a single revision.',
    note: 'Saving a PDF as a new file rewrites it as one revision, so this does not show it was never changed.',
  };
}

export function pdfSignatures(s: PdfStructure): Observation {
  const base = { id: 'pdf.signatures', check: 'Digital signatures', method: STRUCTURE_METHOD };
  if (!s.signatures.length) {
    return { ...base, status: 'none', finding: 'The PDF has no digital signature.', note: 'Most PDFs are not digitally signed.' };
  }
  const n = s.signatures.length;
  const when = s.signatures.map((x) => x.signedAt).filter(Boolean);
  const intro = `The PDF has ${n} digital signature${n === 1 ? '' : 's'}${when.length ? ` (signing time recorded: ${when.join(', ')})` : ''}.`;
  if (s.bytesAfterLastSignature > 16) {
    return {
      ...base,
      status: 'noted',
      finding: `${intro} ${s.bytesAfterLastSignature.toLocaleString('en-IN')} bytes were added after the part covered by the last signature.`,
      note: 'Content added after signing is not covered by the signature. It can be harmless, such as a later signature, form field or timestamp, or a change to what is shown. The signatures themselves were not checked here.',
    };
  }
  return {
    ...base,
    status: 'noted',
    finding: `${intro} The last signature covers the whole file as it is now.`,
    note: 'The signatures themselves were not checked here: an examiner can check who signed and whether the signatures are valid with a PDF reader or pdfsig.',
  };
}

export function pdfDates(info: { creator?: string; producer?: string; created?: Date; modified?: Date }): Observation {
  const base = {
    id: 'pdf.dates',
    check: 'When the PDF was created and last changed',
    method: 'Read the PDF’s document information (CreationDate, ModDate, Creator, Producer). Repeat with: exiftool -PDF:all <file>, or pdfinfo <file>.',
  };
  const software = [info.creator && `created with ${quote(info.creator)}`, info.producer && `produced by ${quote(info.producer)}`].filter(Boolean).join(', ');
  const sw = software ? ` It was ${software}.` : '';
  if (!info.created || !info.modified) {
    return {
      ...base,
      status: 'unavailable',
      finding: `The PDF does not record both when it was created and when it was last changed.${sw}`,
      note: 'These fields are optional, and many tools leave them out.',
    };
  }
  if (Math.abs(info.modified.getTime() - info.created.getTime()) > 60_000) {
    return {
      ...base,
      status: 'noted',
      finding: `The PDF records it was created on ${formatIst(info.created)} and last changed on ${formatIst(info.modified)}.${sw}`,
      note: 'The change date is updated whenever software saves the PDF again, for any reason. Both dates are written by software and can be set to anything.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: `The PDF records the same time for when it was created and last changed (${formatIst(info.created)}).${sw}`,
    note: 'These dates are written by software and can be set to anything, so matching dates do not show the PDF is unchanged.',
  };
}
