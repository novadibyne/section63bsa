// Reading parts of a file as text, for finding metadata such as XMP packets without parsing every format.

const EDGE = 4 * 1024 * 1024;

/** The first and last 4 MB of a file (or all of it, if smaller), as Latin-1 text: one character per byte. */
export async function headTail(file: Blob, edge = EDGE): Promise<{ head: string; tail: string; whole: boolean }> {
  const latin1 = new TextDecoder('latin1');
  if (file.size <= edge * 2) {
    const all = latin1.decode(new Uint8Array(await file.arrayBuffer()));
    return { head: all, tail: '', whole: true };
  }
  const head = latin1.decode(new Uint8Array(await file.slice(0, edge).arrayBuffer()));
  const tail = latin1.decode(new Uint8Array(await file.slice(file.size - edge).arrayBuffer()));
  return { head, tail, whole: false };
}

export interface XmpInfo {
  present: boolean;
  creatorTool?: string;
  /** Software named in the XMP editing history (xmpMM:History), in order. */
  historyAgents: string[];
  /** History entries with the action "saved" or "converted". */
  historySaves: number;
  /** IPTC digital source type URIs, e.g. …/digitalsourcetype/trainedAlgorithmicMedia. */
  digitalSourceTypes: string[];
}

const attrOrElement = (text: string, name: string): string[] => {
  const out: string[] = [];
  const esc = name.replace(':', '\\:');
  for (const m of text.matchAll(new RegExp(`${esc}\\s*=\\s*"([^"]{1,300})"`, 'g'))) out.push(m[1]);
  for (const m of text.matchAll(new RegExp(`<${esc}>([^<]{1,300})</${esc}>`, 'g'))) out.push(m[1]);
  return out.map((v) => v.trim()).filter(Boolean);
};

/** Reads the XMP packet(s) found in the text: creator tool, editing history and digital source type. */
export function xmpInfo(text: string): XmpInfo {
  const packets = [...text.matchAll(/<x:xmpmeta[\s\S]{0,400000}?<\/x:xmpmeta>/g)].map((m) => m[0]);
  const xmp = packets.join('\n');
  const sourceTypes = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/cv\.iptc\.org\/newscodes\/digitalsourcetype\/([A-Za-z]+)/g)) sourceTypes.add(m[1]);
  return {
    present: packets.length > 0,
    creatorTool: attrOrElement(xmp, 'xmp:CreatorTool')[0],
    historyAgents: attrOrElement(xmp, 'stEvt:softwareAgent'),
    historySaves: attrOrElement(xmp, 'stEvt:action').filter((a) => a === 'saved' || a === 'converted').length,
    digitalSourceTypes: [...sourceTypes],
  };
}

/** Uncompressed PNG text chunks (tEXt, and iTXt without compression), keyword → text. */
export function pngTextChunks(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || sig.some((b, i) => bytes[i] !== b)) return out;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');
  let p = 8;
  while (p + 12 <= bytes.length) {
    const len = view.getUint32(p);
    const type = latin1.decode(bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, Math.min(p + 8 + len, bytes.length));
    if (type === 'tEXt' || type === 'iTXt') {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const key = latin1.decode(data.subarray(0, nul));
        if (type === 'tEXt') out[key] = latin1.decode(data.subarray(nul + 1));
        else if (data[nul + 1] === 0) {
          // iTXt: keyword\0 compressionFlag compressionMethod language\0 translatedKeyword\0 text
          let q = nul + 3;
          q = data.indexOf(0, q) + 1;
          q = data.indexOf(0, q) + 1;
          if (q > 0) out[key] = utf8.decode(data.subarray(q));
        }
      }
    }
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return out;
}

export const quote = (s: string, max = 120) => `‘${s.length > max ? `${s.slice(0, max)}…` : s}’`;
