import type { FileMember } from '@/lib/types';
import type { Detection } from '../detect';
import { findChatEntry } from '../detect';
import { sha256Bytes } from '../hash-core';
import { formatIst } from '@/lib/time';
import { parseWhatsAppChat, type ChatSummary } from './whatsapp';

export interface MetaRow {
  label: string;
  value: string;
}

export interface ExtractedMetadata {
  summary: MetaRow[];
  make?: string;
  model?: string;
  chat?: ChatSummary;
  error?: string;
  [key: string]: unknown;
}

export interface ExtractResult {
  metadata: ExtractedMetadata;
  members?: FileMember[];
}

function chatRows(chat: ChatSummary): MetaRow[] {
  const rows: MetaRow[] = [
    { label: 'Platform', value: chat.platform === 'ios' ? 'iPhone (iOS)' : chat.platform === 'android' ? 'Android' : 'Unknown' },
    { label: 'Participants', value: chat.participants.join(', ') || '—' },
    { label: 'Messages', value: String(chat.messageCount) },
  ];
  if (chat.firstMessage) rows.push({ label: 'First message', value: chat.firstMessage });
  if (chat.lastMessage) rows.push({ label: 'Last message', value: chat.lastMessage });
  if (chat.mediaReferenceCount) rows.push({ label: 'Media references', value: String(chat.mediaReferenceCount) });
  if (chat.systemMessageCount) rows.push({ label: 'System notices', value: String(chat.systemMessageCount) });
  rows.push({ label: 'Date format', value: chat.dateOrder });
  return rows;
}

async function whatsappZip(file: Blob): Promise<ExtractResult> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  const members: FileMember[] = [];
  for (const entry of entries) {
    const bytes = await entry.async('uint8array');
    members.push({ name: entry.name, sizeBytes: bytes.byteLength, sha256: await sha256Bytes(bytes) });
  }
  const chatName = findChatEntry(entries.map((e) => e.name));
  const chat = chatName ? parseWhatsAppChat(await zip.file(chatName)!.async('string')) : undefined;
  const summary: MetaRow[] = [];
  if (chatName) summary.push({ label: 'Chat file', value: chatName });
  summary.push({ label: 'Files in archive', value: String(members.length) });
  if (chat) summary.push(...chatRows(chat));
  return { metadata: { summary, chat }, members };
}

async function emailHeaders(file: Blob): Promise<ExtractedMetadata> {
  const head = (await file.slice(0, 64 * 1024).text()).split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  const get = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(head)?.[1]?.trim();
  const summary: MetaRow[] = [];
  for (const [label, key] of [
    ['From', 'From'],
    ['To', 'To'],
    ['Subject', 'Subject'],
    ['Date', 'Date'],
    ['Message-ID', 'Message-ID'],
  ] as const) {
    const v = get(key);
    if (v) summary.push({ label, value: v });
  }
  return { summary };
}

export async function extractMetadata(file: File, det: Detection): Promise<ExtractResult> {
  const base: MetaRow[] = [];
  if (file.lastModified) base.push({ label: 'File last modified', value: formatIst(new Date(file.lastModified)) });
  try {
    switch (det.kind) {
      case 'image': {
        const { imageMetadata } = await import('./image');
        const r = await imageMetadata(file);
        return { metadata: { summary: [...r.summary, ...base], make: r.make, model: r.model } };
      }
      case 'audio':
      case 'video': {
        const { mediaMetadata } = await import('./media');
        const r = await mediaMetadata(file, det.kind);
        return { metadata: { summary: [...r.summary, ...base] } };
      }
      case 'whatsapp_export': {
        if (det.detectedMime === 'application/zip') {
          const r = await whatsappZip(file);
          r.metadata.summary.push(...base);
          return r;
        }
        const chat = parseWhatsAppChat(await file.text());
        return { metadata: { summary: [...chatRows(chat), ...base], chat } };
      }
      case 'email': {
        const r = await emailHeaders(file);
        return { metadata: { summary: [...r.summary, ...base] } };
      }
      case 'document': {
        if (det.detectedMime === 'application/pdf') {
          const { pdfMetadata } = await import('./pdf');
          const r = await pdfMetadata(file);
          return { metadata: { summary: [...r.summary, ...base] } };
        }
        return { metadata: { summary: base } };
      }
      default:
        return { metadata: { summary: base } };
    }
  } catch (err) {
    return {
      metadata: {
        summary: [...base, { label: 'Metadata', value: 'Could not be read from this file' }],
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** One-line description used to pre-fill "any other relevant information" in the certificate. */
export function metadataSentence(filename: string, rows: MetaRow[]): string {
  const keep = rows.filter((r) => !/^(EXIF|Metadata|Media details|Date format)$/.test(r.label)).slice(0, 6);
  return keep.length ? `${filename}: ${keep.map((r) => `${r.label} ${r.value}`).join('; ')}` : filename;
}
