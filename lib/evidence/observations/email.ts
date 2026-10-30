// Emails (.eml): the route recorded by mail servers, the sent date, the message ID and DKIM signatures.
import { formatIst } from '@/lib/time';
import { quote } from './bytes';
import type { Observation } from './types';

export interface Header {
  name: string;
  value: string;
}

/** Headers of an email, in order, with folded lines joined. */
export function parseHeaders(raw: string): Header[] {
  const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  return head
    .split(/\r?\n/)
    .map((l) => /^([!-9;-~]+):\s*(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ name: m[1], value: m[2].trim() }));
}

const all = (h: Header[], name: string) => h.filter((x) => x.name.toLowerCase() === name.toLowerCase()).map((x) => x.value);
const parseDate = (v: string | undefined) => {
  const t = v ? Date.parse(v.replace(/\s*\([^)]*\)\s*$/, '')) : NaN;
  return Number.isNaN(t) ? undefined : t;
};
/** The organisation's domain: example.co.in from mail.example.co.in, gmail.com from mail.gmail.com. */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/[>\s]/g, '').split('.').filter(Boolean);
  const second = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu', 'nic', 'res', 'gen', 'firm', 'ind', 'ltd', 'plc']);
  const n = parts.length >= 3 && parts[parts.length - 1].length === 2 && second.has(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join('.');
}
const domainOf = (address: string | undefined) => {
  const m = address && /@([A-Za-z0-9.-]+)/.exec(address);
  return m ? m[1].toLowerCase() : undefined;
};

const METHOD = 'Read the email’s headers. Repeat by opening the .eml file in a text editor, or with an email header analyser.';

export function emailRoute(h: Header[]): Observation {
  const base = { id: 'email.route', check: 'Route recorded by mail servers (Received headers)', method: `${METHOD} Each Received time was compared with the one above it (servers add theirs at the top).` };
  const times = all(h, 'Received')
    .map((v) => parseDate(v.split(';').pop()))
    .filter((t): t is number => t !== undefined);
  if (!times.length) {
    return {
      ...base,
      status: 'noted',
      finding: 'The email has no Received headers, so it records no route through mail servers.',
      note: 'Every server that delivers an email adds a Received header. Emails saved from a Sent folder or as drafts, and some exported messages, have none.',
    };
  }
  // Top to bottom is newest to oldest; a later time further down means the order is broken.
  let worst = 0;
  for (let i = 1; i < times.length; i++) worst = Math.max(worst, times[i] - times[i - 1]);
  if (worst > 5 * 60_000) {
    return {
      ...base,
      status: 'noted',
      finding: `The email passed through ${times.length} servers, but their times are out of order: a server is recorded as handling it ${Math.round(worst / 60_000)} minutes after the one listed above it.`,
      note: 'Each server records its own clock, so small differences are normal. Large ones can come from a wrong server clock or from headers changed after delivery.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: `The email passed through ${times.length} server${times.length === 1 ? '' : 's'}, with times in order from ${formatIst(new Date(Math.min(...times)))} to ${formatIst(new Date(Math.max(...times)))}.`,
    note: 'Headers changed with care would not show up here.',
  };
}

export function emailDate(h: Header[]): Observation {
  const base = { id: 'email.date', check: 'Sent date against delivery', method: `${METHOD} Compared the Date header with the earliest Received time.` };
  const sent = parseDate(all(h, 'Date')[0]);
  const received = all(h, 'Received')
    .map((v) => parseDate(v.split(';').pop()))
    .filter((t): t is number => t !== undefined);
  if (sent === undefined || !received.length) {
    return { ...base, status: 'unavailable', finding: 'The email lacks a sent date or a delivery time to compare.', note: 'Both are needed for this check.' };
  }
  const first = Math.min(...received);
  const diff = sent - first;
  if (diff > 10 * 60_000 || diff < -24 * 3600_000) {
    return {
      ...base,
      status: 'noted',
      finding: `The email says it was sent on ${formatIst(new Date(sent))}, and the first server received it on ${formatIst(new Date(first))}.`,
      note: diff > 0
        ? 'The sent date is set by the sender’s device, so a wrong clock can put it after delivery; so can a Date header changed later.'
        : 'Long gaps happen with messages queued while offline or delayed by servers, and with a wrong clock on the sender’s device.',
    };
  }
  return { ...base, status: 'none', finding: `The sent date (${formatIst(new Date(sent))}) fits the delivery time.`, note: 'Both can be set by the sender, so this does not show the email is unchanged.' };
}

export function emailIds(h: Header[]): Observation {
  const base = { id: 'email.ids', check: 'Message ID and sender domain', method: `${METHOD} Compared the domain of the Message-ID with the domain of the From address.` };
  const from = domainOf(all(h, 'From')[0]);
  const id = domainOf(all(h, 'Message-ID')[0]);
  if (!from || !id) {
    return { ...base, status: 'unavailable', finding: 'The email lacks a From address or a Message-ID to compare.', note: 'Both are normally present.' };
  }
  if (baseDomain(from) !== baseDomain(id)) {
    return {
      ...base,
      status: 'noted',
      finding: `The sender’s address is at ${quote(from)}, and the Message-ID was made at ${quote(id)}.`,
      note: 'Mail services often make IDs under their own domain (Outlook, for example), so a difference is common. It can also show the email was sent through a different service from the one its address suggests.',
    };
  }
  return { ...base, status: 'none', finding: `The Message-ID was made at the sender’s domain (${quote(id)}).`, note: 'Both can be set by the sender.' };
}

export function emailDkim(h: Header[]): Observation {
  const base = {
    id: 'email.dkim',
    check: 'DKIM signatures',
    method: `${METHOD} Listed the DKIM-Signature headers. Checking a signature needs the sender’s public key from the internet, so the signatures were not checked here.`,
  };
  const sigs = all(h, 'DKIM-Signature').map((v) => ({ d: /\bd=([^;\s]+)/.exec(v)?.[1], s: /\bs=([^;\s]+)/.exec(v)?.[1] }));
  if (!sigs.length) {
    return { ...base, status: 'none', finding: 'The email has no DKIM signature.', note: 'Many mail services sign every email; some do not. Without a signature, the content cannot be checked this way.' };
  }
  const from = domainOf(all(h, 'From')[0]);
  const domains = [...new Set(sigs.map((x) => x.d).filter(Boolean))] as string[];
  const aligned = from ? domains.some((d) => baseDomain(d) === baseDomain(from)) : false;
  return {
    ...base,
    status: 'noted',
    finding: `The email is signed with DKIM by ${domains.map((d) => quote(d)).join(', ')}${from ? (aligned ? ', the sender’s own domain' : `, which is not the sender’s domain (${quote(from)})`) : ''}. The signature was not checked.`,
    note: 'A DKIM signature lets an examiner check that the signed headers and body are unchanged since the sending server signed them, using the key the domain publishes. Keys are sometimes replaced over time, so checking old emails may not be possible.',
  };
}

export function emailObservations(raw: string): Observation[] {
  const h = parseHeaders(raw);
  return [emailRoute(h), emailDate(h), emailIds(h), emailDkim(h)];
}
