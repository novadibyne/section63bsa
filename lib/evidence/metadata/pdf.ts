import { formatIst } from '@/lib/time';
import type { MetaRow } from './index';

export async function pdfMetadata(file: Blob) {
  const { PDFDocument } = await import('pdf-lib');
  const summary: MetaRow[] = [];
  const doc = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
  summary.push({ label: 'Pages', value: String(doc.getPageCount()) });
  const add = (label: string, v: string | undefined) => v && summary.push({ label, value: v });
  add('Title', doc.getTitle());
  add('Author', doc.getAuthor());
  add('Creator', doc.getCreator());
  add('Producer', doc.getProducer());
  const c = doc.getCreationDate();
  const m = doc.getModificationDate();
  if (c) add('Created', formatIst(c));
  if (m) add('Modified', formatIst(m));
  if (doc.isEncrypted) add('Encryption', 'Encrypted');
  return { summary };
}
