// Provenance: Content Credentials (C2PA), AI-generation labels and the editing history kept in XMP metadata.
import { assetPath } from '@/lib/config';
import { formatIst } from '@/lib/time';
import { pngTextChunks, quote, type XmpInfo } from './bytes';
import type { Observation } from './types';

/* ───────────────────────── Content Credentials (C2PA) ───────────────────────── */

const C2PA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/svg+xml',
  'image/x-adobe-dng',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/vnd.wave',
  'audio/mpeg',
  'application/pdf',
]);
const C2PA_MAX_BYTES = 1024 * 1024 * 1024;
const C2PA_METHOD =
  'Read on this device with the open-source C2PA library (c2pa-rs, through @contentauth/c2pa-web). Nothing was fetched from the internet: online credentials, revocation and trust lists were not checked. Repeat with: c2patool <file>.';

/** Whether the bytes contain a C2PA manifest store (a JUMBF box labelled c2pa) or a link to one stored online. */
export function hasC2paMarker(text: string): boolean {
  return /jumb[\s\S]{0,64}c2pa|c2pa\.(?:claim|signature|assertions)|dcterms:provenance/.test(text);
}

type C2paApi = Awaited<ReturnType<typeof import('@contentauth/c2pa-web').createC2pa>>;
let c2paPromise: Promise<C2paApi> | undefined;
function c2pa(): Promise<C2paApi> {
  c2paPromise ??= import('@contentauth/c2pa-web').then(({ createC2pa }) =>
    createC2pa({
      wasmSrc: new URL(assetPath('vendor/c2pa/c2pa.wasm'), window.location.href).href,
      // Everything stays on the device: no online manifests, no certificate status checks.
      settings: { verify: { remoteManifestFetch: false, ocspFetch: false } },
    }),
  );
  return c2paPromise;
}

interface C2paAction {
  action?: string;
  softwareAgent?: string | { name?: string; version?: string };
  digitalSourceType?: string;
}

/** What the credentials say, for the observation and the AI-label check. */
export interface C2paSummary {
  observation: Observation;
  generator?: string;
  sourceTypes: string[];
}

const agentName = (a: C2paAction['softwareAgent']) =>
  typeof a === 'string' ? a : a?.name ? [a.name, a.version].filter(Boolean).join(' ') : undefined;

const ACTION_WORDS: Record<string, string> = {
  'c2pa.created': 'created',
  'c2pa.opened': 'opened',
  'c2pa.placed': 'placed into another file',
  'c2pa.edited': 'edited',
  'c2pa.color_adjustments': 'colour adjusted',
  'c2pa.cropped': 'cropped',
  'c2pa.resized': 'resized',
  'c2pa.filtered': 'filtered',
  'c2pa.drawing': 'drawn on',
  'c2pa.converted': 'converted',
  'c2pa.transcoded': 'transcoded',
  'c2pa.repackaged': 'repackaged',
  'c2pa.published': 'published',
  'c2pa.removed': 'parts removed',
  'c2pa.redacted': 'redacted',
};

export async function contentCredentials(file: Blob, mime: string | undefined, text: string): Promise<C2paSummary> {
  const base = { id: 'provenance.c2pa', check: 'Content Credentials (C2PA)', method: C2PA_METHOD };
  if (!hasC2paMarker(text)) {
    return {
      sourceTypes: [],
      observation: {
        ...base,
        status: 'none',
        finding: 'No Content Credentials (C2PA) were found in the file.',
        note: 'Most phones, cameras and messaging apps do not add Content Credentials, and WhatsApp and many websites remove them. Their absence says nothing about whether the file was changed.',
      },
    };
  }
  if (!mime || !C2PA_TYPES.has(mime) || file.size > C2PA_MAX_BYTES) {
    return {
      sourceTypes: [],
      observation: {
        ...base,
        status: 'unavailable',
        finding: 'The file seems to contain Content Credentials (C2PA), but this file type or size cannot be read here.',
        note: 'An examiner can read them with c2patool or the Content Credentials website.',
      },
    };
  }
  try {
    const api = await c2pa();
    const reader = await api.reader.fromBlob(mime, file);
    if (!reader) {
      return {
        sourceTypes: [],
        observation: { ...base, status: 'none', finding: 'No Content Credentials (C2PA) were found in the file.', note: 'Their absence says nothing about whether the file was changed.' },
      };
    }
    try {
      const store = (await reader.manifestStore()) as {
        validation_state?: string;
        validation_status?: { code: string; explanation?: string }[];
      };
      const active = (await reader.activeManifest()) as {
        claim_generator?: string;
        claim_generator_info?: { name?: string; version?: string }[];
        signature_info?: { issuer?: string; common_name?: string; time?: string };
        assertions?: { label: string; data: unknown }[];
      };
      const generator =
        active.claim_generator_info?.map((g) => [g.name, g.version].filter(Boolean).join(' ')).join(', ') || active.claim_generator;
      const actions: C2paAction[] = (active.assertions ?? [])
        .filter((a) => a.label.startsWith('c2pa.actions'))
        .flatMap((a) => ((a.data as { actions?: C2paAction[] })?.actions ?? []));
      const sourceTypes = [...new Set(actions.map((a) => a.digitalSourceType?.split('/').pop()).filter((s): s is string => !!s))];
      const sig = active.signature_info ?? {};
      // Only an "Invalid" verdict counts; an untrusted signing certificate is expected without a trust list.
      const problems = store.validation_state === 'Invalid' ? (store.validation_status ?? []).filter((s) => !/untrusted/i.test(s.code)) : [];
      const steps = actions
        .map((a) => [ACTION_WORDS[a.action ?? ''] ?? a.action, agentName(a.softwareAgent) ? `with ${quote(agentName(a.softwareAgent)!)}` : ''].filter(Boolean).join(' '))
        .filter(Boolean);
      const signedBy = [sig.common_name && quote(sig.common_name), sig.issuer && `issued by ${quote(sig.issuer)}`].filter(Boolean).join(', ');
      const when = sig.time && !Number.isNaN(Date.parse(sig.time)) ? ` on ${formatIst(new Date(sig.time))}` : '';
      const parts = [
        `The file carries Content Credentials made with ${quote(generator ?? 'unknown software')}${signedBy ? `, signed by ${signedBy}` : ''}${when}.`,
        steps.length ? `Recorded steps: ${steps.join('; ')}.` : '',
        problems.length
          ? `The check reported: ${problems.map((p) => `${p.code}${p.explanation ? ` (${p.explanation})` : ''}`).join('; ')}.`
          : 'The file’s content matches what was signed.',
      ];
      return {
        generator,
        sourceTypes,
        observation: {
          ...base,
          status: 'noted',
          finding: parts.filter(Boolean).join(' '),
          note: problems.length
            ? 'A mismatch usually means the file’s content changed after the credentials were signed. The signer’s identity was not checked against a list of trusted issuers.'
            : 'Content Credentials record how a file was made and changed, signed by the software that wrote them. A match means the content is as it was when signed; the signer’s identity was not checked against a list of trusted issuers.',
        },
      };
    } finally {
      await reader.free();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const remote = /RemoteManifestUrl\("([^"]+)"\)/.exec(message)?.[1];
    if (remote) {
      return {
        sourceTypes: [],
        observation: {
          ...base,
          status: 'noted',
          finding: `The file refers to Content Credentials stored online at ${remote}. They were not downloaded, because the app sends nothing from this device.`,
          note: 'An examiner can open the address to read them.',
        },
      };
    }
    return {
      sourceTypes: [],
      observation: { ...base, status: 'unavailable', finding: `The Content Credentials could not be read (${message.slice(0, 160)}).`, note: 'An examiner can read them with c2patool.' },
    };
  }
}

/* ───────────────────────── AI-generation labels ───────────────────────── */

/** IPTC digital source types that describe content made or changed by algorithms, including generative AI. */
const AI_SOURCE_TYPES: Record<string, string> = {
  trainedAlgorithmicMedia: 'created by a trained algorithm (generative AI)',
  compositeWithTrainedAlgorithmicMedia: 'combined with content from a trained algorithm (generative AI)',
  algorithmicallyEnhanced: 'enhanced by an algorithm',
  algorithmicMedia: 'created by an algorithm',
  compositeSynthetic: 'a composite including synthetic content',
};
/** Image and media generators that write their name into the files they make. */
const GENERATORS =
  /\b(DALL[·\-. ]?E|OpenAI|ChatGPT|Midjourney|Stable ?Diffusion|SDXL|ComfyUI|AUTOMATIC1111|InvokeAI|NovelAI|Firefly|Imagen|Gemini|Bing Image Creator|Leonardo\.?Ai|Ideogram|Runway|Sora|Pika|Kling|Flux|Grok|Meta AI)\b/i;
/** Text chunk keywords written by Stable Diffusion front ends (prompt and settings). */
const GENERATOR_PNG_KEYS = ['parameters', 'prompt', 'workflow', 'Dream', 'sd-metadata', 'invokeai_metadata', 'generation_data'];

export interface AiLabelInput {
  xmp: XmpInfo;
  c2paSourceTypes: string[];
  c2paGenerator?: string;
  /** Software-like fields from EXIF or the format itself, e.g. Software, ImageDescription. */
  softwareFields: string[];
  /** For PNG files: the uncompressed text chunks. */
  pngText?: Record<string, string>;
}

export function aiLabel(input: AiLabelInput): Observation {
  const found: string[] = [];
  const types = new Set([...input.xmp.digitalSourceTypes, ...input.c2paSourceTypes]);
  for (const t of types) if (AI_SOURCE_TYPES[t]) found.push(`a digital source type of ${quote(t)}: ${AI_SOURCE_TYPES[t]}`);
  const named = [input.c2paGenerator, input.xmp.creatorTool, ...input.xmp.historyAgents, ...input.softwareFields]
    .filter((s): s is string => !!s)
    .map((s) => ({ s, m: GENERATORS.exec(s) }))
    .filter((x) => x.m);
  for (const { s } of named.slice(0, 3)) found.push(`the software name ${quote(s)}`);
  for (const key of GENERATOR_PNG_KEYS) {
    const v = input.pngText?.[key];
    if (v) found.push(`a text chunk ${quote(key)} of the kind image generators write: ${quote(v, 160)}`);
  }
  const other = [...types].filter((t) => !AI_SOURCE_TYPES[t]);
  const method =
    'Searched the file’s XMP metadata and Content Credentials for IPTC digital source types (cv.iptc.org/newscodes/digitalsourcetype), its software fields for the names of image and media generators, and PNG text chunks for generator settings. Repeat with: exiftool -a -G1 <file>.';
  if (found.length) {
    return {
      id: 'provenance.ai-label',
      check: 'Labels written by AI or other generators',
      status: 'noted',
      finding: `The file contains ${found.join('; ')}.`,
      note: 'These labels are written by the software that made or changed the file. They can be removed, or added, by anyone with the right tools, so they are a pointer for an examiner, not proof of how the file was made. Their absence proves nothing.',
      method,
    };
  }
  return {
    id: 'provenance.ai-label',
    check: 'Labels written by AI or other generators',
    status: 'none',
    finding: other.length
      ? `No AI or generator label was found. The file labels its source as ${other.map((t) => quote(t)).join(', ')}.`
      : 'No AI or generator label was found.',
    note: 'Many generators write no label, and labels are easily removed, so their absence says nothing about how the file was made.',
    method,
  };
}

/** PNG text chunks, read from the start of a PNG file. */
export async function pngText(file: Blob): Promise<Record<string, string>> {
  return pngTextChunks(new Uint8Array(await file.slice(0, 8 * 1024 * 1024).arrayBuffer()));
}

/* ───────────────────────── Editing history in XMP ───────────────────────── */

export function xmpHistory(xmp: XmpInfo): Observation {
  const base = {
    id: 'provenance.xmp-history',
    check: 'Editing history kept in the file (XMP)',
    method: 'Read the XMP metadata packet (xmp:CreatorTool and xmpMM:History). Repeat with: exiftool -xmp:all <file>.',
  };
  if (!xmp.present) {
    return { ...base, status: 'none', finding: 'The file holds no XMP metadata, so it keeps no editing history of this kind.', note: 'Many apps write no XMP, and it is easily removed. Its absence says nothing about whether the file was changed.' };
  }
  const agents = [...new Set(xmp.historyAgents)];
  if (agents.length || xmp.historySaves) {
    return {
      ...base,
      status: 'noted',
      finding: [
        `The file’s XMP history lists ${xmp.historySaves} save${xmp.historySaves === 1 ? '' : 's'} or conversion${xmp.historySaves === 1 ? '' : 's'}`,
        agents.length ? ` by ${agents.map((a) => quote(a)).join(', ')}` : '',
        xmp.creatorTool ? `; it names ${quote(xmp.creatorTool)} as the creating software` : '',
        '.',
      ].join(''),
      note: 'Programs such as Photoshop and Lightroom record each save here. It shows which software handled the file, not what was changed.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: xmp.creatorTool ? `The XMP metadata names ${quote(xmp.creatorTool)} as the creating software and records no editing history.` : 'The XMP metadata records no editing history.',
    note: 'No history does not mean the file is unchanged: history is optional and easily removed.',
  };
}
