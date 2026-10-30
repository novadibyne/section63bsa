// WhatsApp exports: the order of message times, deleted and edited notices, and media files against the chat.
import { parseChatMessages, type ChatMessage } from '../metadata/whatsapp';
import type { Observation } from './types';

const METHOD_TEXT = 'Read every line of the exported chat text and its date and time stamps.';

const stamp = (m: ChatMessage) => {
  const [d, mo, y] = m.date.split('/').map(Number);
  const [h, mi] = m.time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
};
const dayOf = (m: ChatMessage) => {
  const [d, mo, y] = m.date.split('/').map(Number);
  return Date.UTC(y, mo - 1, d);
};
const minutes = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m >= 120 ? `${Math.round(m / 60)} hours` : `${m} minute${m === 1 ? '' : 's'}`;
};

export function chatOrder(messages: ChatMessage[]): Observation {
  const base = { id: 'whatsapp.order', check: 'Order of the message times', method: `${METHOD_TEXT} Each time was compared with the one before it.` };
  if (messages.length < 2) {
    return { ...base, status: 'unavailable', finding: 'The export has too few messages to compare.', note: 'At least two messages are needed.' };
  }
  const big: { line: number; back: number }[] = [];
  let small = 0;
  for (let i = 1; i < messages.length; i++) {
    const back = stamp(messages[i - 1]) - stamp(messages[i]);
    if (back > 10 * 60_000) big.push({ line: messages[i].n, back });
    else if (back > 0) small++;
  }
  const smallText = small ? ` ${small} message${small === 1 ? ' is' : 's are'} a few minutes earlier than the one before, which is usual for messages sent while offline.` : '';
  if (big.length) {
    const worst = big.reduce((a, b) => (b.back > a.back ? b : a));
    return {
      ...base,
      status: 'noted',
      finding: `In ${big.length} place${big.length === 1 ? '' : 's'}, a message is dated more than 10 minutes earlier than the message before it (the largest is ${minutes(worst.back)}, at message ${worst.line}).${smallText}`,
      note: 'WhatsApp lists messages in the order they reached the phone, so small steps back are normal. Larger ones can come from a wrong phone clock, messages delayed for a long time, or text changed after the export.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: `All ${messages.length} messages run in time order, allowing for steps back of up to 10 minutes.${smallText}`,
    note: 'Text changed with care after the export would not show up here.',
  };
}

const DELETED = /This message was deleted|You deleted this message|This message was deleted by admin|Waiting for this message/i;
const EDITED = /<?This message was edited>?/i;

export function chatNotices(messages: ChatMessage[]): Observation {
  const base = { id: 'whatsapp.notices', check: 'Deleted and edited messages', method: `${METHOD_TEXT} Counted WhatsApp’s notices for deleted and edited messages.` };
  const deleted = messages.filter((m) => DELETED.test(m.text)).length;
  const edited = messages.filter((m) => EDITED.test(m.text)).length;
  if (deleted || edited) {
    return {
      ...base,
      status: 'noted',
      finding: `The export shows ${[deleted && `${deleted} deleted message${deleted === 1 ? '' : 's'}`, edited && `${edited} edited message${edited === 1 ? '' : 's'}`].filter(Boolean).join(' and ')}.`,
      note: 'WhatsApp leaves these notices when someone deletes or edits a message; the earlier text is not in the export.',
    };
  }
  return { ...base, status: 'none', finding: 'The export shows no deleted or edited messages.', note: 'Messages deleted “for me” leave no notice.' };
}

/** The date in a WhatsApp media file name: IMG-20240115-WA0003.jpg (Android) or 00000012-PHOTO-2024-01-15-10-31-05.jpg (iPhone). */
export function mediaNameDate(name: string): number | undefined {
  const a = /(?:IMG|VID|AUD|PTT|DOC|STK)-(\d{4})(\d{2})(\d{2})-WA\d+/i.exec(name);
  if (a) return Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const i = /\d+-[A-Z]+-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}/i.exec(name);
  if (i) return Date.UTC(+i[1], +i[2] - 1, +i[3]);
  return undefined;
}

const basename = (p: string) => p.split('/').pop() ?? p;

export function chatMedia(messages: ChatMessage[], memberNames: string[] | undefined, chatName?: string): Observation {
  const base = {
    id: 'whatsapp.media',
    check: 'Media files compared with the chat',
    method: `${METHOD_TEXT} Matched the files named in the chat with the files in the .zip export, and compared the date in each WhatsApp file name with the date of its message.`,
  };
  if (!memberNames) {
    return { ...base, status: 'unavailable', finding: 'This export is the chat text alone, without media files to compare.', note: 'Exports made “with media” are .zip files that include them.' };
  }
  const files = new Set(memberNames.map(basename).filter((n) => n !== basename(chatName ?? '') && !/\.txt$/i.test(n)));
  const referenced = new Map<string, ChatMessage>();
  for (const m of messages) {
    for (const r of m.text.matchAll(/<attached: ([^>]+)>|(\S+\.[A-Za-z0-9]{2,5}) \(file attached\)/g)) referenced.set(basename((r[1] ?? r[2]).trim()), m);
  }
  const missing = [...referenced.keys()].filter((n) => !files.has(n));
  const extra = [...files].filter((n) => !referenced.has(n));
  // More than a day apart, so a message sent just before midnight and saved just after is not counted.
  const misdated = [...referenced].filter(([n, m]) => {
    const d = mediaNameDate(n);
    return d !== undefined && Math.abs(d - dayOf(m)) > 86_400_000;
  });
  const facts = [
    missing.length && `${missing.length} file${missing.length === 1 ? ' named' : 's named'} in the chat ${missing.length === 1 ? 'is' : 'are'} not in the export (for example ${missing[0]})`,
    extra.length && `${extra.length} file${extra.length === 1 ? '' : 's'} in the export ${extra.length === 1 ? 'is' : 'are'} not named in the chat (for example ${extra[0]})`,
    misdated.length && `${misdated.length} file name${misdated.length === 1 ? '' : 's'} carr${misdated.length === 1 ? 'ies' : 'y'} a date more than a day away from ${misdated.length === 1 ? 'its' : 'their'} message (for example ${misdated[0][0]}, sent ${misdated[0][1].date})`,
  ].filter(Boolean);
  if (facts.length) {
    return {
      ...base,
      status: 'noted',
      finding: `${facts.join('; ')}.`,
      note: 'Files go missing when media was not downloaded or was deleted from the phone before the export, and WhatsApp names files by the day they were saved on the phone. Files added to, removed from or renamed in the .zip after the export also show up here.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: referenced.size ? `All ${referenced.size} files named in the chat are in the export, and their names match the dates of their messages.` : 'The chat names no media files, and the export holds none besides the chat.',
    note: 'A file replaced by another with the same name would not show up here; its hash in the hash report identifies it.',
  };
}

export function whatsappObservations(text: string, memberNames?: string[], chatName?: string): Observation[] {
  const { messages } = parseChatMessages(text);
  return [chatOrder(messages), chatNotices(messages), chatMedia(messages, memberNames, chatName)];
}
