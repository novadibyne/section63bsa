// Pictures: editing software, capture and change dates, the preview stored inside the file, and the camera named.
import { quote } from './bytes';
import { grayFromImage, hamming, phashFromGray, rotateGray } from './phash';
import type { Observation } from './types';

/** Image editors and apps that write their name into the pictures they save. */
const EDITORS =
  /photoshop|lightroom|adobe express|\bgimp\b|snapseed|picsart|canva|pixelmator|affinity photo|paint\.net|photopea|fotor|remini|faceapp|meitu|photodirector|polarr|\bvsco\b|facetune|luminar|capture one|paintshop|corel|krita|photoscape|irfanview|xnview|imagemagick|graphicsmagick|microsoft paint|\bmspaint\b|picasa|pixlr|befunky|inshot|photoroom|lensa|airbrush/i;

export interface ExifTags {
  Software?: string;
  Make?: string;
  Model?: string;
  DateTimeOriginal?: string;
  CreateDate?: string;
  ModifyDate?: string;
  ImageDescription?: string;
  Artist?: string;
}

const EXIF_METHOD = 'Read from the file’s EXIF metadata. Repeat with: exiftool -Software -Make -Model -DateTimeOriginal -CreateDate -ModifyDate <file>.';

/** "2024:01:15 10:31:05" → milliseconds (device clock, no time zone), or undefined. */
export function exifTime(v: string | undefined): number | undefined {
  const m = v && /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : undefined;
}
const shown = (v: string) => {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : v;
};

export function imageSoftware(tags: ExifTags | undefined, xmpCreatorTool: string | undefined): Observation {
  const base = { id: 'image.software', check: 'Software named in the picture', method: EXIF_METHOD };
  const names = [tags?.Software, xmpCreatorTool].filter((s): s is string => !!s?.trim()).map((s) => s.trim());
  const editors = names.filter((n) => EDITORS.test(n));
  if (editors.length) {
    return {
      ...base,
      status: 'noted',
      finding: `The picture names the software ${editors.map((e) => quote(e)).join(' and ')}, an image editing app.`,
      note: 'Editing apps write their name when they save a picture, including for small changes such as cropping or brightness. The name shows which software last saved it, not what was changed.',
    };
  }
  if (names.length) {
    return {
      ...base,
      status: 'none',
      finding: `The picture names the software ${names.map((n) => quote(n)).join(' and ')}, which is not on the app’s list of image editors.`,
      note: 'Phones often record their firmware version here. Editors are not always recorded, so this does not show the picture is unchanged.',
    };
  }
  return { ...base, status: 'none', finding: 'The picture names no software.', note: 'Many phones and most messaging apps write no software name, and it is easily removed.' };
}

export function imageDates(tags: ExifTags | undefined): Observation {
  const base = { id: 'image.dates', check: 'When it was taken and when it was last changed', method: EXIF_METHOD };
  const taken = tags?.DateTimeOriginal ?? tags?.CreateDate;
  const changed = tags?.ModifyDate;
  const t = exifTime(taken);
  const c = exifTime(changed);
  if (t === undefined || c === undefined) {
    return {
      ...base,
      status: 'unavailable',
      finding: taken
        ? `The picture records when it was taken (${shown(taken)}, device clock) but not when it was last changed.`
        : 'The picture records no “date taken”.',
      note: 'Screenshots, pictures sent through WhatsApp and many apps keep no such dates, so this could not be compared.',
    };
  }
  if (Math.abs(c - t) > 60_000) {
    return {
      ...base,
      status: 'noted',
      finding: `The picture records it was taken at ${shown(taken!)} and last changed at ${shown(changed!)} (device clock).`,
      note: 'The two usually match for a picture straight from a camera. Apps update the “last changed” time when they save a picture again, which can be an edit, a rotation or a re-save.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: `The picture records the same time for when it was taken and last changed (${shown(taken!)}, device clock).`,
    note: 'These dates are written by the device and can be changed with common tools, so matching dates do not show the picture is unchanged.',
  };
}

/** Compares the small preview kept inside a JPEG with the picture itself, allowing for rotation and black borders. */
export async function imagePreview(file: Blob): Promise<Observation> {
  const base = {
    id: 'image.preview',
    check: 'Preview stored inside the picture',
    method:
      'Compared the perceptual hash (DCT pHash, 64 bits) of the EXIF thumbnail with that of the picture, allowing for rotation and black borders; a difference above 14 of 64 bits is noted. Repeat by extracting the preview with: exiftool -b -ThumbnailImage <file> > preview.jpg.',
  };
  const { default: exifr } = await import('exifr');
  let thumb: Uint8Array | undefined;
  try {
    thumb = (await exifr.thumbnail(file)) as Uint8Array | undefined;
  } catch {
    thumb = undefined;
  }
  if (!thumb?.length) {
    return { ...base, status: 'unavailable', finding: 'The picture holds no stored preview to compare.', note: 'Many apps, and WhatsApp, save pictures without one.' };
  }
  try {
    const main = phashFromGray(await grayFromImage(file));
    let g = await grayFromImage(new Blob([thumb as BlobPart], { type: 'image/jpeg' }), true);
    let best = 64;
    for (let r = 0; r < 4; r++) {
      best = Math.min(best, hamming(main, phashFromGray(g)));
      g = rotateGray(g);
    }
    if (best > 14) {
      return {
        ...base,
        status: 'noted',
        finding: `The preview stored inside the picture differs noticeably from the picture itself (${best} of 64 bits differ).`,
        note: 'Cameras save a small preview when the picture is taken. Some editors change the picture but leave the old preview, so the two can differ after an edit; cropping or unusual previews can also cause a difference.',
      };
    }
    return {
      ...base,
      status: 'none',
      finding: `The preview stored inside the picture matches the picture (${best} of 64 bits differ).`,
      note: 'Editors that also update the preview leave no difference here, so a match does not show the picture is unchanged.',
    };
  } catch {
    return { ...base, status: 'unavailable', finding: 'The picture or its preview could not be decoded in this browser.', note: 'An examiner can compare them with other tools.' };
  }
}

/** The picture's perceptual hash, for finding near-duplicates in the same record. */
export async function imagePhash(file: Blob): Promise<string | undefined> {
  try {
    return phashFromGray(await grayFromImage(file));
  } catch {
    return undefined;
  }
}
