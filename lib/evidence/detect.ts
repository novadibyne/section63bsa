import { fileTypeFromBlob } from 'file-type';
import type { EvidenceType } from '@/lib/types';
import { isWhatsAppText } from './metadata/whatsapp';

export interface Detection {
  detectedMime?: string;
  detectedExt?: string;
  kind: EvidenceType;
}

const DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument',
  'application/vnd.openxmlformats-officedocument',
];

const WHATSAPP_CHAT_NAME = /(^|\/)(_chat\.txt|WhatsApp Chat[^/]*\.txt)$/i;

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function kindForMime(mime: string | undefined): EvidenceType {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'message/rfc822') return 'email';
  if (mime.startsWith('text/') || DOC_MIMES.some((d) => mime.startsWith(d))) return 'document';
  return 'other';
}

export async function zipHasWhatsAppChat(file: Blob): Promise<boolean> {
  const { default: JSZip } = await import('jszip');
  try {
    const zip = await JSZip.loadAsync(file);
    return Object.keys(zip.files).some((n) => WHATSAPP_CHAT_NAME.test(n));
  } catch {
    return false;
  }
}

export function findChatEntry(names: string[]): string | undefined {
  return names.find((n) => WHATSAPP_CHAT_NAME.test(n)) ?? names.find((n) => /\.txt$/i.test(n) && !n.includes('/'));
}

/** Detects the real type from the file's bytes (magic numbers), not its extension. */
export async function detectFile(file: File): Promise<Detection> {
  let detected: { mime: string; ext: string } | undefined;
  try {
    detected = await fileTypeFromBlob(file);
  } catch {
    detected = undefined;
  }
  const ext = extOf(file.name);

  if (detected?.mime === 'application/zip') {
    if (file.size < 1024 * 1024 * 1024 && (await zipHasWhatsAppChat(file))) {
      return { detectedMime: detected.mime, detectedExt: detected.ext, kind: 'whatsapp_export' };
    }
    return { detectedMime: detected.mime, detectedExt: detected.ext, kind: 'other' };
  }

  if (!detected) {
    // Text-based formats have no magic number.
    if (ext === 'txt' || file.type.startsWith('text/')) {
      const sample = await file.slice(0, 16 * 1024).text();
      if (isWhatsAppText(sample)) return { detectedMime: 'text/plain', detectedExt: 'txt', kind: 'whatsapp_export' };
      return { detectedMime: 'text/plain', detectedExt: ext || 'txt', kind: 'document' };
    }
    if (ext === 'eml' || file.type === 'message/rfc822') return { detectedMime: 'message/rfc822', detectedExt: 'eml', kind: 'email' };
    if (['csv', 'json', 'xml', 'html', 'htm', 'md', 'log'].includes(ext))
      return { detectedMime: file.type || 'text/plain', detectedExt: ext, kind: 'document' };
    return { detectedMime: file.type || undefined, detectedExt: ext || undefined, kind: kindForMime(file.type) };
  }

  return { detectedMime: detected.mime, detectedExt: detected.ext, kind: kindForMime(detected.mime) };
}

export const KIND_LABEL: Record<EvidenceType, string> = {
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  document: 'Document',
  whatsapp_export: 'WhatsApp export',
  email: 'Email',
  other: 'Other file',
};
