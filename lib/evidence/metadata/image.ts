import type { MetaRow } from './index';

function exifDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]} (device clock)` : v;
}

export async function imageMetadata(file: Blob) {
  const { default: exifr } = await import('exifr');
  let tags: Record<string, unknown> | undefined;
  let gps: { latitude?: number; longitude?: number } | undefined;
  try {
    tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,
      xmp: false,
      icc: false,
      iptc: false,
      jfif: false,
      reviveValues: false,
      translateValues: true,
    });
  } catch {
    tags = undefined;
  }
  try {
    gps = await exifr.gps(file);
  } catch {
    gps = undefined;
  }

  let width = (tags?.ExifImageWidth ?? tags?.ImageWidth) as number | undefined;
  let height = (tags?.ExifImageHeight ?? tags?.ImageHeight) as number | undefined;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    /* format not decodable by this browser (e.g. HEIC) */
  }

  const make = typeof tags?.Make === 'string' ? (tags.Make as string).trim() : undefined;
  const model = typeof tags?.Model === 'string' ? (tags.Model as string).trim() : undefined;
  const summary: MetaRow[] = [];
  if (make) summary.push({ label: 'Camera make', value: make });
  if (model) summary.push({ label: 'Camera model', value: model });
  const taken = exifDate(tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate);
  if (taken) summary.push({ label: 'Captured', value: taken });
  if (typeof tags?.Software === 'string') summary.push({ label: 'Software', value: tags.Software as string });
  if (width && height) summary.push({ label: 'Dimensions', value: `${width} × ${height} px` });
  if (gps?.latitude != null && gps?.longitude != null)
    summary.push({ label: 'GPS', value: `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` });
  if (!tags) summary.push({ label: 'EXIF', value: 'None found (common for screenshots and images forwarded via WhatsApp)' });

  return { summary, make, model };
}
