import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { pngTextChunks, xmpInfo } from '@/lib/evidence/observations/bytes';
import { aiLabel, hasC2paMarker, xmpHistory } from '@/lib/evidence/observations/provenance';
import { imageDates, imageSoftware } from '@/lib/evidence/observations/image';
import { pdfDates, pdfRevisions, pdfSignatures, pdfStructure } from '@/lib/evidence/observations/pdf';
import { officeChanges, officeParts, officeProperties } from '@/lib/evidence/observations/office';
import { mediaEncoder, mediaTimes } from '@/lib/evidence/observations/media';
import { mediaNameDate, whatsappObservations } from '@/lib/evidence/observations/whatsapp';
import { baseDomain, emailObservations } from '@/lib/evidence/observations/email';
import { hamming, phashFromGray, rotateGray } from '@/lib/evidence/observations/phash';
import { cameraAgainstDevice, nearDuplicates } from '@/lib/evidence/observations/cross';
import type { Observation } from '@/lib/evidence/observations/types';
import type { Device, EvidenceFile } from '@/lib/types';

const seen: Observation[] = [];
const keep = <T extends Observation | Observation[] | undefined>(o: T): T => {
  if (Array.isArray(o)) seen.push(...o);
  else if (o) seen.push(o);
  return o;
};
const byId = (list: Observation[], id: string) => list.find((o) => o.id === id)!;
const latin1 = (b: Buffer) => new TextDecoder('latin1').decode(b);

const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmp:CreatorTool="Adobe Photoshop 25.0 (Windows)"
  Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia">
  <xmpMM:History><rdf:Seq><rdf:li stEvt:action="created" stEvt:softwareAgent="Adobe Firefly"/>
  <rdf:li stEvt:action="saved" stEvt:softwareAgent="Adobe Photoshop 25.0 (Windows)"/></rdf:Seq></xmpMM:History>
  </rdf:Description></rdf:RDF></x:xmpmeta>`;

describe('provenance', () => {
  it('reads XMP creator tool, editing history and digital source type', () => {
    const x = xmpInfo(`junk${XMP}junk`);
    expect(x).toMatchObject({ present: true, creatorTool: 'Adobe Photoshop 25.0 (Windows)', historySaves: 1 });
    expect(x.historyAgents).toEqual(['Adobe Firefly', 'Adobe Photoshop 25.0 (Windows)']);
    expect(x.digitalSourceTypes).toEqual(['trainedAlgorithmicMedia']);
    expect(keep(xmpHistory(x)).status).toBe('noted');
    expect(keep(xmpHistory(xmpInfo('no xmp here'))).status).toBe('none');
  });

  it('notes AI labels, generator names and generator settings, and says nothing is proven', () => {
    const empty = xmpInfo('');
    const label = keep(aiLabel({ xmp: xmpInfo(XMP), c2paSourceTypes: [], softwareFields: [] }));
    expect(label.status).toBe('noted');
    expect(label.finding).toContain('trainedAlgorithmicMedia');
    expect(keep(aiLabel({ xmp: empty, c2paSourceTypes: ['digitalCapture'], softwareFields: ['SM-S911B firmware'] })).status).toBe('none');
    expect(keep(aiLabel({ xmp: empty, c2paSourceTypes: [], softwareFields: ['Midjourney v6'] })).finding).toContain('Midjourney');
    // A PNG from a Stable Diffusion front end keeps its prompt and settings in a "parameters" text chunk.
    const png = pngWithText('parameters', 'a court building, Steps: 30, Sampler: Euler a, CFG scale: 7');
    const chunks = pngTextChunks(png);
    expect(chunks.parameters).toContain('Steps: 30');
    expect(keep(aiLabel({ xmp: empty, c2paSourceTypes: [], softwareFields: [], pngText: chunks })).status).toBe('noted');
  });

  it('spots Content Credentials in real C2PA files and not in ordinary ones', () => {
    const fixtures = join(__dirname, 'fixtures');
    expect(hasC2paMarker(latin1(readFileSync(join(fixtures, 'c2pa/C.jpg'))))).toBe(true);
    expect(hasC2paMarker(latin1(readFileSync(join(fixtures, 'c2pa/XCA.jpg'))))).toBe(true);
    expect(hasC2paMarker(latin1(readFileSync(join(fixtures, 'imei-screen.png'))))).toBe(false);
  });
});

function pngWithText(key: string, text: string): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    return out;
  };
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const text8 = new TextEncoder().encode(`${key}\0${text}`);
  const parts = [sig, chunk('IHDR', new Uint8Array(13)), chunk('tEXt', text8), chunk('IEND', new Uint8Array(0))];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return all;
}

describe('pictures', () => {
  it('notes editing apps, not phone firmware', () => {
    expect(keep(imageSoftware({ Software: 'Adobe Photoshop 25.0 (Windows)' }, undefined)).status).toBe('noted');
    expect(keep(imageSoftware({ Software: 'Snapseed 2.0' }, undefined)).finding).toContain('Snapseed');
    expect(keep(imageSoftware({ Software: 'S911BXXU3CXH1' }, undefined)).status).toBe('none');
    expect(keep(imageSoftware(undefined, undefined)).status).toBe('none');
  });

  it('compares when a picture was taken with when it was last changed', () => {
    expect(keep(imageDates({ DateTimeOriginal: '2026:01:15 10:31:05', ModifyDate: '2026:03:02 18:00:00' })).status).toBe('noted');
    expect(keep(imageDates({ DateTimeOriginal: '2026:01:15 10:31:05', ModifyDate: '2026:01:15 10:31:05' })).status).toBe('none');
    expect(keep(imageDates({})).status).toBe('unavailable');
  });

  it('gives near-identical pictures near-identical perceptual hashes', () => {
    // A 32 × 32 "scene" with waves and a bright block; a recompressed copy adds small noise and brightness.
    const scene = Float64Array.from({ length: 1024 }, (_, i) => {
      const x = i % 32;
      const y = Math.floor(i / 32);
      return 128 + 60 * Math.sin(x / 3) * Math.cos(y / 5) + 40 * Math.sin((x + y) / 7) + (x > 10 && x < 20 && y > 5 && y < 15 ? 50 : 0);
    });
    const copy = scene.map((v, i) => v * 1.1 + 10 + ((i * 7919) % 5) - 2);
    const other = Float64Array.from({ length: 1024 }, (_, i) => 128 + 70 * Math.cos((i % 32) / 2 + Math.floor(i / 32) / 9) + (i >= 640 ? -60 : 30));
    const h = phashFromGray(scene);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hamming(h, phashFromGray(copy))).toBeLessThanOrEqual(4);
    expect(hamming(h, phashFromGray(other))).toBeGreaterThan(14);
    let r: Float64Array = Float64Array.from(scene);
    for (let i = 0; i < 4; i++) r = rotateGray(r);
    expect(phashFromGray(r)).toBe(h);
  });
});

describe('PDFs', () => {
  const pdf = (body: string) => `%PDF-1.7\n${body}`;
  it('counts revisions appended after the PDF was first written, allowing for fast web view', () => {
    const one = pdfStructure(pdf('1 0 obj<<>>endobj\nxref\ntrailer<<>>\nstartxref\n9\n%%EOF\n'));
    expect(one.laterRevisions).toBe(0);
    expect(keep(pdfRevisions(one)).status).toBe('none');
    const two = pdfStructure(pdf('xref\nstartxref\n9\n%%EOF\n2 0 obj<<>>endobj\nxref\nstartxref\n99\n%%EOF\n'));
    expect(two.laterRevisions).toBe(1);
    expect(keep(pdfRevisions(two)).status).toBe('noted');
    const linear = pdfStructure(pdf('1 0 obj<</Linearized 1>>endobj\nstartxref\n0\n%%EOF\nstartxref\n9\n%%EOF\n'));
    expect(linear.laterRevisions).toBe(0);
  });

  it('notes signatures and content added after the last one', () => {
    const head = pdf('1 0 obj<</Type/Sig/M(D:20260115103105+05\'30\')/ByteRange [0 100 200 ');
    const covered = `${head}50]>>endobj\n`;
    const whole = pdfStructure(covered.padEnd(250, ' '));
    expect(keep(pdfSignatures(whole)).finding).toContain('covers the whole file');
    const appended = pdfStructure(`${covered.padEnd(250, ' ')}2 0 obj<<>>endobj\nxref\nstartxref\n251\n%%EOF\n`);
    expect(appended.bytesAfterLastSignature).toBeGreaterThan(16);
    expect(keep(pdfSignatures(appended)).finding).toMatch(/bytes were added after/);
    expect(keep(pdfSignatures(pdfStructure(pdf('')))).status).toBe('none');
  });

  it('compares the creation and change dates', () => {
    const created = new Date('2026-01-15T05:00:00Z');
    expect(keep(pdfDates({ producer: 'iLovePDF', created, modified: new Date('2026-02-01T05:00:00Z') })).status).toBe('noted');
    expect(keep(pdfDates({ created, modified: created })).status).toBe('none');
    expect(keep(pdfDates({})).status).toBe('unavailable');
  });
});

describe('Office files', () => {
  it('reads properties, tracked changes and comments from a .docx', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    zip.file('docProps/core.xml', '<cp:coreProperties><dc:creator>Ravi</dc:creator><cp:lastModifiedBy>Meera</cp:lastModifiedBy><cp:revision>7</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-01-15T05:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-02-01T05:00:00Z</dcterms:modified></cp:coreProperties>');
    zip.file('docProps/app.xml', '<Properties><TotalTime>42</TotalTime><Application>Microsoft Office Word</Application></Properties>');
    zip.file('word/document.xml', '<w:document><w:ins w:id="1"/><w:del w:id="2"/><w:del w:id="3"/></w:document>');
    zip.file('word/comments.xml', '<w:comments><w:comment w:id="0"/></w:comments>');
    const parts = await officeParts(new Blob([await zip.generateAsync({ type: 'uint8array' }) as BlobPart]));
    const props = keep(officeProperties(parts));
    expect(props.status).toBe('noted');
    expect(props.finding).toContain('last saved by ‘Meera’');
    expect(props.finding).toContain('42 minutes');
    const changes = keep(officeChanges(parts));
    expect(changes.finding).toBe('The file still contains 1 tracked insertion, 2 tracked deletions, 1 comment.');
    expect(keep(officeChanges({ comments: 0 })).status).toBe('none');
  });
});

describe('video and audio', () => {
  it('notes converters and editors, and empty or differing recording times', () => {
    expect(keep(mediaEncoder({ tools: ['Lavf60.3.100'], hasTimes: true })).status).toBe('noted');
    expect(keep(mediaEncoder({ tools: ['Samsung Camera'], hasTimes: true })).status).toBe('none');
    expect(keep(mediaTimes({ tools: [], hasTimes: true, creationTime: new Date(Date.UTC(1904, 0, 1)) })).finding).toContain('empty');
    const t = new Date('2026-01-15T05:00:00Z');
    expect(keep(mediaTimes({ tools: [], hasTimes: true, creationTime: t, modificationTime: new Date('2026-01-20T05:00:00Z') })).status).toBe('noted');
    expect(keep(mediaTimes({ tools: [], hasTimes: true, creationTime: t, modificationTime: t })).status).toBe('none');
    expect(keep(mediaTimes({ tools: [], hasTimes: false })).status).toBe('unavailable');
  });
});

describe('WhatsApp exports', () => {
  const chat = [
    '15/01/2026, 10:30 - Ravi: Hello',
    '15/01/2026, 10:31 - Meera: IMG-20260115-WA0001.jpg (file attached)',
    '15/01/2026, 10:29 - Ravi: sent while offline',
    '15/01/2026, 09:00 - Meera: This message was deleted',
    '16/01/2026, 08:00 - Ravi: VID-20260120-WA0002.mp4 (file attached)',
    '16/01/2026, 08:05 - Meera: Fine <This message was edited>',
  ].join('\n');

  it('notes large steps back in time, deleted and edited messages, and media that does not match the chat', () => {
    const list = keep(whatsappObservations(chat, ['WhatsApp Chat with Meera.txt', 'IMG-20260115-WA0001.jpg', 'VID-20260120-WA0002.mp4', 'IMG-20260301-WA0009.jpg'], 'WhatsApp Chat with Meera.txt'));
    const order = byId(list, 'whatsapp.order');
    expect(order.status).toBe('noted');
    expect(order.finding).toContain('1 place');
    expect(order.finding).toContain('1 message is a few minutes earlier');
    expect(byId(list, 'whatsapp.notices').finding).toBe('The export shows 1 deleted message and 1 edited message.');
    const media = byId(list, 'whatsapp.media');
    expect(media.finding).toContain('1 file in the export is not named in the chat (for example IMG-20260301-WA0009.jpg)');
    expect(media.finding).toContain('VID-20260120-WA0002.mp4, sent 16/01/2026');
    expect(byId(keep(whatsappObservations(chat)), 'whatsapp.media').status).toBe('unavailable');
  });

  it('reads the dates in Android and iPhone media names', () => {
    expect(mediaNameDate('IMG-20260115-WA0001.jpg')).toBe(Date.UTC(2026, 0, 15));
    expect(mediaNameDate('00000012-PHOTO-2026-01-15-10-31-05.jpg')).toBe(Date.UTC(2026, 0, 15));
    expect(mediaNameDate('holiday.jpg')).toBeUndefined();
  });
});

describe('emails', () => {
  const eml = (headers: string[]) => `${headers.join('\r\n')}\r\n\r\nBody`;
  const signed = eml([
    'Received: from mx.example.co.in by mx.google.com; Thu, 15 Jan 2026 10:31:10 +0530',
    'Received: from laptop by mail.example.co.in; Thu, 15 Jan 2026 10:31:02 +0530',
    'DKIM-Signature: v=1; a=rsa-sha256; d=example.co.in; s=mail; h=from:to; bh=x; b=y',
    'From: Ravi <ravi@example.co.in>',
    'Date: Thu, 15 Jan 2026 10:31:00 +0530',
    'Message-ID: <abc123@mail.example.co.in>',
  ]);

  it('finds nothing to note in an ordinary delivered email, and lists its DKIM signature unchecked', () => {
    const list = keep(emailObservations(signed));
    expect(byId(list, 'email.route').status).toBe('none');
    expect(byId(list, 'email.date').status).toBe('none');
    expect(byId(list, 'email.ids').status).toBe('none');
    const dkim = byId(list, 'email.dkim');
    expect(dkim.finding).toContain('the sender’s own domain');
    expect(dkim.finding).toContain('was not checked');
  });

  it('notes a broken route, a sent date after delivery, a different ID domain and no route at all', () => {
    const odd = keep(
      emailObservations(
        eml([
          'Received: by mx.google.com; Thu, 15 Jan 2026 10:00:00 +0530',
          'Received: by mail.example.com; Thu, 15 Jan 2026 11:00:00 +0530',
          'From: <ravi@example.com>',
          'Date: Thu, 15 Jan 2026 12:00:00 +0530',
          'Message-ID: <1@PR3P123.prod.outlook.com>',
        ]),
      ),
    );
    expect(byId(odd, 'email.route').status).toBe('noted');
    expect(byId(odd, 'email.date').status).toBe('noted');
    expect(byId(odd, 'email.ids').status).toBe('noted');
    expect(byId(keep(emailObservations(eml(['From: a@b.com']))), 'email.route').finding).toContain('no Received headers');
    expect(baseDomain('mail.example.co.in')).toBe('example.co.in');
    expect(baseDomain('mail.gmail.com')).toBe('gmail.com');
  });
});

describe('comparing files in a record', () => {
  const file = (id: string, sha256: string, phash?: string, camera?: { make?: string; model?: string }) =>
    ({ id, sha256, originalFilename: `${id}.jpg`, observations: { rules: '1.0', checkedAt: '', items: [], phash, camera } }) as unknown as EvidenceFile;

  it('notes pictures that look the same but are not identical', () => {
    const a = file('a', 'aa', '0123456789abcdef');
    const b = file('b', 'bb', '0123456789abcdee');
    const c = file('c', 'cc', 'fedcba9876543210');
    expect(keep(nearDuplicates(a, [a, b, c]))!.finding).toContain('‘b.jpg’');
    expect(keep(nearDuplicates(c, [a, b, c]))!.status).toBe('none');
    expect(nearDuplicates(file('d', 'dd'), [a])).toBeUndefined();
  });

  it('compares the camera named in a picture with the device in step 2', () => {
    const pic = file('p', 'pp', undefined, { make: 'samsung', model: 'SM-S911B' });
    const device = (makeModel?: string) => ({ makeModel }) as Device;
    expect(keep(cameraAgainstDevice(pic, device('Samsung Galaxy S23 (SM-S911B)')))!.status).toBe('none');
    expect(keep(cameraAgainstDevice(pic, device('Apple iPhone 14')))!.status).toBe('noted');
    expect(keep(cameraAgainstDevice(pic, device()))!.status).toBe('unavailable');
  });
});

describe('wording', () => {
  it('never states a conclusion about a file', () => {
    expect(seen.length).toBeGreaterThan(40);
    for (const o of seen) {
      const words = `${o.check} ${o.finding} ${o.note}`;
      expect(words, o.id).not.toMatch(/\b(fake|forged|forgery|tampered|tampering|doctored|genuine|authentic|verified|proves? that)\b/i);
      expect(o.method, o.id).toBeTruthy();
    }
  });
});
