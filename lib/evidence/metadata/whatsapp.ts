// Parses WhatsApp "Export chat" text files.
//   Android: 12/10/26, 10:31 pm - Name: message
//   iOS:     [12/10/26, 10:31:05 PM] Name: message

export interface ChatMessage {
  n: number;
  date: string; // DD/MM/YYYY
  time: string; // HH:mm (24h)
  sender?: string;
  text: string;
  system: boolean;
  media: boolean;
}

export interface ChatSummary {
  platform: 'android' | 'ios' | 'unknown';
  dateOrder: 'DMY' | 'MDY' | 'ambiguous (read as DMY)';
  participants: string[];
  messageCount: number;
  systemMessageCount: number;
  mediaReferenceCount: number;
  firstMessage?: string;
  lastMessage?: string;
  preview: ChatMessage[];
}

const LINE =
  /^\[?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:[\s  ]*([ap])\.?\s?m\.?)?\]?\s*(?:[-–]\s+)?(.*)$/i;
const SENDER = /^([^:\n]{1,80}?):\s([\s\S]*)$/;
const MEDIA =
  /<Media omitted>|<attached: [^>]+>|\(file attached\)|\b(image|video|audio|sticker|document|GIF) omitted\b|<This message was edited>/i;
const INVISIBLE = /[‎‏‪-‮﻿]/g;

interface RawMsg {
  a: number;
  b: number;
  y: number;
  hh: number;
  mm: number;
  ampm?: string;
  rest: string;
  ios: boolean;
}

function splitRaw(text: string): RawMsg[] {
  const out: RawMsg[] = [];
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(INVISIBLE, '');
    const m = LINE.exec(line);
    if (m) {
      out.push({
        a: +m[1],
        b: +m[2],
        y: +m[3],
        hh: +m[4],
        mm: +m[5],
        ampm: m[7]?.toLowerCase(),
        rest: m[8] ?? '',
        ios: line.trimStart().startsWith('['),
      });
    } else if (out.length) {
      out[out.length - 1].rest += `\n${line}`;
    }
  }
  return out;
}

export function isWhatsAppText(sample: string): boolean {
  const lines = sample.replace(INVISIBLE, '').split(/\r?\n/).slice(0, 40);
  let hits = 0;
  for (const l of lines) {
    const m = LINE.exec(l);
    if (m && SENDER.test(m[8] ?? '')) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

export function parseWhatsAppChat(text: string, previewLimit = 200): ChatSummary {
  const raw = splitRaw(text);
  let dmy = false;
  let mdy = false;
  for (const r of raw) {
    if (r.a > 12) dmy = true;
    if (r.b > 12) mdy = true;
  }
  const order: ChatSummary['dateOrder'] = dmy && !mdy ? 'DMY' : mdy && !dmy ? 'MDY' : 'ambiguous (read as DMY)';
  const useMdy = order === 'MDY';

  const participants = new Set<string>();
  let system = 0;
  let media = 0;
  const preview: ChatMessage[] = [];
  const messages: ChatMessage[] = raw.map((r, i) => {
    const day = useMdy ? r.b : r.a;
    const month = useMdy ? r.a : r.b;
    const year = r.y < 100 ? 2000 + r.y : r.y;
    let hh = r.hh;
    if (r.ampm === 'p' && hh < 12) hh += 12;
    if (r.ampm === 'a' && hh === 12) hh = 0;
    const s = SENDER.exec(r.rest);
    const isSystem = !s;
    const body = (s ? s[2] : r.rest).trim();
    const isMedia = MEDIA.test(body);
    if (s) participants.add(s[1].trim());
    if (isSystem) system++;
    if (isMedia) media++;
    return {
      n: i + 1,
      date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      time: `${String(hh).padStart(2, '0')}:${String(r.mm).padStart(2, '0')}`,
      sender: s?.[1].trim(),
      text: body,
      system: isSystem,
      media: isMedia,
    };
  });
  for (const m of messages) {
    if (preview.length >= previewLimit) break;
    preview.push(m.text.length > 600 ? { ...m, text: `${m.text.slice(0, 600)}…` } : m);
  }
  const first = messages[0];
  const last = messages[messages.length - 1];
  return {
    platform: raw.length ? (raw[0].ios ? 'ios' : 'android') : 'unknown',
    dateOrder: order,
    participants: [...participants],
    messageCount: messages.length - system,
    systemMessageCount: system,
    mediaReferenceCount: media,
    firstMessage: first ? `${first.date} ${first.time}` : undefined,
    lastMessage: last ? `${last.date} ${last.time}` : undefined,
    preview,
  };
}
