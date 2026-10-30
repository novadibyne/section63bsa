// Observations that compare a file with the rest of its record: near-duplicate pictures, and the camera named in a
// picture against the device described in step 2. Worked out when shown, because the record can change.
import type { Device, EvidenceFile } from '@/lib/types';
import { quote } from './bytes';
import { hamming } from './phash';
import type { Observation } from './types';

/** Pictures this close (bits of 64) look the same to a person. */
export const NEAR_DUPLICATE_BITS = 6;

export function nearDuplicates(file: EvidenceFile, others: EvidenceFile[]): Observation | undefined {
  const mine = file.observations?.phash;
  if (!mine) return undefined;
  const base = {
    id: 'record.near-duplicate',
    check: 'Pictures in this record that look the same',
    method: `Compared the perceptual hash (DCT pHash, 64 bits) of each picture in the record; ${NEAR_DUPLICATE_BITS} or fewer differing bits are noted when the SHA-256 differs.`,
  };
  const matches = others
    .filter((o) => o.id !== file.id && o.observations?.phash && o.sha256 !== file.sha256)
    .map((o) => ({ o, d: hamming(mine, o.observations!.phash!) }))
    .filter((x) => x.d <= NEAR_DUPLICATE_BITS);
  if (!matches.length) {
    return { ...base, status: 'none', finding: 'No other picture in this record looks the same.', note: 'Only pictures in this record are compared.' };
  }
  return {
    ...base,
    status: 'noted',
    finding: `This picture looks the same as ${matches.map((m) => quote(m.o.originalFilename)).join(', ')}, but the files are not identical (their SHA-256 values differ).`,
    note: 'One may be a resized, recompressed or slightly changed copy of the other, or both may be copies of a third picture, such as a photo and the same photo sent through WhatsApp.',
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function cameraAgainstDevice(file: EvidenceFile, device: Device | undefined): Observation | undefined {
  const cam = file.observations?.camera;
  if (!cam?.make && !cam?.model) return undefined;
  const named = [cam.make, cam.model].filter(Boolean).join(' ');
  const base = {
    id: 'record.camera-device',
    check: 'Camera named in the picture against the device in step 2',
    method: 'Compared the EXIF Make and Model with the make and model entered for the device in step 2 (letters and digits only).',
  };
  const described = device?.makeModel?.trim();
  if (!described) {
    return { ...base, status: 'unavailable', finding: `The picture names the camera ${quote(named)}; no device make and model has been entered in step 2 yet.`, note: 'Enter the device in step 2 to compare.' };
  }
  const d = norm(described);
  const makeOk = !!cam.make && d.includes(norm(cam.make));
  const modelOk = !!cam.model && (d.includes(norm(cam.model)) || norm(cam.model).includes(d));
  if (makeOk || modelOk) {
    return {
      ...base,
      status: 'none',
      finding: `The picture names the camera ${quote(named)}, which matches the device entered in step 2 (${quote(described)}).`,
      note: 'Camera names are written by the device and can be edited, so a match does not show which phone took the picture.',
    };
  }
  return {
    ...base,
    status: 'noted',
    finding: `The picture names the camera ${quote(named)}, but the device entered in step 2 is ${quote(described)}.`,
    note: 'A picture may have been taken on another phone and sent to this one, or the device details may use a different name for the same model (for example a marketing name instead of the model number).',
  };
}

export function crossObservations(file: EvidenceFile, others: EvidenceFile[], device: Device | undefined): Observation[] {
  return [cameraAgainstDevice(file, device), nearDuplicates(file, others)].filter((o): o is Observation => !!o);
}
