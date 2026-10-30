// Runs the file observations that apply to a file's kind. Everything happens on this device.
import type { EvidenceType } from '@/lib/types';
import { nowIso } from '@/lib/time';
import { headTail, xmpInfo } from './bytes';
import { aiLabel, contentCredentials, pngText, xmpHistory } from './provenance';
import { imageDates, imagePhash, imagePreview, imageSoftware, type ExifTags } from './image';
import { pdfDates, pdfRevisions, pdfSignatures, pdfStructure } from './pdf';
import { officeChanges, officeParts, officeProperties } from './office';
import { mediaEncoder, mediaInfo, mediaTimes } from './media';
import { whatsappObservations } from './whatsapp';
import { emailObservations } from './email';
import { OBSERVATION_RULES_VERSION, type FileObservations, type Observation } from './types';

export * from './types';
export { crossObservations } from './cross';

interface Target {
  kind: EvidenceType;
  detectedMime?: string;
}

const PDF_READ_LIMIT = 200 * 1024 * 1024;

/** Runs one check; a check that fails becomes "Not checked" instead of stopping the others. */
async function safe(id: string, check: string, run: () => Promise<Observation> | Observation): Promise<Observation> {
  try {
    return await run();
  } catch (err) {
    return {
      id,
      check,
      status: 'unavailable',
      finding: `This check could not be completed on this file (${(err instanceof Error ? err.message : String(err)).slice(0, 140)}).`,
      note: 'An examiner can repeat it with the tool named below.',
      method: 'See the check’s description in the user manual.',
    };
  }
}

async function readExif(file: Blob): Promise<ExifTags | undefined> {
  const { default: exifr } = await import('exifr');
  try {
    return (await exifr.parse(file, { tiff: true, exif: true, gps: false, xmp: false, icc: false, iptc: false, jfif: false, reviveValues: false, translateValues: false })) as ExifTags | undefined;
  } catch {
    return undefined;
  }
}

async function chatOf(file: Blob, target: Target): Promise<{ text: string; names?: string[]; chatName?: string }> {
  if (target.detectedMime !== 'application/zip') return { text: await file.text() };
  const { default: JSZip } = await import('jszip');
  const { findChatEntry } = await import('../detect');
  const zip = await JSZip.loadAsync(file);
  const names = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name);
  const chatName = findChatEntry(names);
  return { text: chatName ? await zip.file(chatName)!.async('string') : '', names, chatName };
}

export async function observeFile(file: Blob, target: Target): Promise<FileObservations | undefined> {
  const items: Observation[] = [];
  const result: FileObservations = { rules: OBSERVATION_RULES_VERSION, checkedAt: nowIso(), items };
  const mime = target.detectedMime;
  const isOffice = !!mime?.startsWith('application/vnd.openxmlformats-officedocument');
  const isPdf = mime === 'application/pdf';
  const withProvenance = target.kind === 'image' || target.kind === 'video' || target.kind === 'audio' || isPdf;

  if (withProvenance) {
    const { head, tail } = await headTail(file);
    const text = head + tail;
    const xmp = xmpInfo(text);
    const c2pa = await contentCredentials(file, mime, text).catch((err) => ({
      sourceTypes: [] as string[],
      generator: undefined,
      observation: {
        id: 'provenance.c2pa',
        check: 'Content Credentials (C2PA)',
        status: 'unavailable' as const,
        finding: `The Content Credentials could not be read (${String(err).slice(0, 140)}).`,
        note: 'An examiner can read them with c2patool.',
        method: 'c2patool <file>',
      },
    }));
    items.push(c2pa.observation);
    const exif = target.kind === 'image' ? await readExif(file) : undefined;
    const png = mime === 'image/png' ? await pngText(file).catch(() => undefined) : undefined;
    items.push(
      await safe('provenance.ai-label', 'Labels written by AI or other generators', () =>
        aiLabel({
          xmp,
          c2paSourceTypes: c2pa.sourceTypes,
          c2paGenerator: c2pa.generator,
          softwareFields: [exif?.Software, exif?.ImageDescription, exif?.Artist].filter((s): s is string => !!s),
          pngText: png,
        }),
      ),
    );

    if (target.kind === 'image') {
      items.push(await safe('image.software', 'Software named in the picture', () => imageSoftware(exif, xmp.creatorTool)));
      items.push(await safe('image.dates', 'When it was taken and when it was last changed', () => imageDates(exif)));
      if (mime === 'image/jpeg') items.push(await safe('image.preview', 'Preview stored inside the picture', () => imagePreview(file)));
      result.phash = await imagePhash(file);
      const make = exif?.Make?.trim();
      const model = exif?.Model?.trim();
      if (make || model) result.camera = { make, model };
    } else if (isPdf) {
      const whole = file.size <= PDF_READ_LIMIT ? new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer())) : text;
      const structure = pdfStructure(whole);
      items.push(await safe('pdf.revisions', 'Changes saved after the PDF was first written', () => pdfRevisions(structure)));
      items.push(await safe('pdf.signatures', 'Digital signatures', () => pdfSignatures(structure)));
      items.push(
        await safe('pdf.dates', 'When the PDF was created and last changed', async () => {
          const { PDFDocument } = await import('pdf-lib');
          const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
          return pdfDates({ creator: doc.getCreator(), producer: doc.getProducer(), created: doc.getCreationDate(), modified: doc.getModificationDate() });
        }),
      );
    } else {
      const info = await mediaInfo(file).catch(() => undefined);
      if (info) {
        items.push(mediaEncoder(info), mediaTimes(info));
      } else {
        items.push(
          await safe('media.encoder', 'Encoder or editing software named in the file', () => {
            throw new Error('the file’s tags could not be read');
          }),
        );
      }
    }
    items.push(xmpHistory(xmp));
  } else if (isOffice) {
    const parts = await officeParts(file).catch(() => undefined);
    if (parts) items.push(officeProperties(parts), officeChanges(parts));
  } else if (target.kind === 'whatsapp_export') {
    const chat = await chatOf(file, target);
    items.push(...whatsappObservations(chat.text, chat.names, chat.chatName));
  } else if (target.kind === 'email') {
    items.push(...emailObservations(await file.slice(0, 256 * 1024).text()));
  }
  return result;
}
