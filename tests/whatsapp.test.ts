import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isWhatsAppText, parseWhatsAppChat } from '@/lib/evidence/metadata/whatsapp';

const android = readFileSync(new URL('./fixtures/whatsapp-android.txt', import.meta.url), 'utf8');
const ios = readFileSync(new URL('./fixtures/whatsapp-ios.txt', import.meta.url), 'utf8');

describe('WhatsApp parser', () => {
  it('detects chat exports', () => {
    expect(isWhatsAppText(android)).toBe(true);
    expect(isWhatsAppText(ios)).toBe(true);
    expect(isWhatsAppText('Dear Sir,\nPlease find attached.')).toBe(false);
  });

  it('parses an Android export', () => {
    const c = parseWhatsAppChat(android);
    expect(c.platform).toBe('android');
    expect(c.dateOrder).toBe('DMY');
    expect(c.participants).toEqual(['Ravi Sharma', 'Meera Iyer']);
    expect(c.messageCount).toBe(5);
    expect(c.systemMessageCount).toBe(1);
    expect(c.mediaReferenceCount).toBe(1);
    expect(c.firstMessage).toBe('28/05/2026 22:30');
    expect(c.lastMessage).toBe('28/05/2026 22:41');
    expect(c.preview[4].text).toContain('second line');
  });

  it('parses an iOS export with 12-hour times', () => {
    const c = parseWhatsAppChat(ios);
    expect(c.platform).toBe('ios');
    expect(c.participants).toEqual(['Ravi Sharma', 'Meera Iyer']);
    expect(c.preview[0].time).toBe('22:31');
    expect(c.preview[1].time).toBe('00:05');
    expect(c.mediaReferenceCount).toBe(1);
  });
});
