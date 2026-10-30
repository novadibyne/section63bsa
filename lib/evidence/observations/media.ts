// Video and audio: the encoder named in the file and the recording times kept by the container.
import { formatIst } from '@/lib/time';
import { quote } from './bytes';
import type { Observation } from './types';

/** Converters and editors that name themselves in the video and audio files they write. */
const MEDIA_TOOLS =
  /\blavf|\blavc|ffmpeg|handbrake|premiere|media encoder|after effects|audition|davinci|resolve|capcut|inshot|kinemaster|\bvn\b|filmora|imovie|final cut|audacity|garageband|wavepad|ocenaudio|\bvlc\b|\blame\b|shotcut|openshot|clipchamp|movavi|camtasia|powerdirector|youcut|splice|videoleap|canva/i;

export interface MediaInfo {
  /** Encoder and tool names found in the container's tags. */
  tools: string[];
  creationTime?: Date;
  modificationTime?: Date;
  /** Whether the container keeps creation and change times at all (MP4, MOV and similar). */
  hasTimes: boolean;
}

const METHOD =
  'Read the container’s tags and its creation and change times (music-metadata). Repeat with: ffprobe -show_format <file>, or mediainfo <file>.';

/** MP4 and MOV times count from 1904; a missing time reads as that date or as 1970. */
const isZero = (d: Date | undefined) => !d || Number.isNaN(d.getTime()) || d.getUTCFullYear() <= 1970;

export function mediaEncoder(m: MediaInfo): Observation {
  const base = { id: 'media.encoder', check: 'Encoder or editing software named in the file', method: METHOD };
  const tools = [...new Set(m.tools.map((t) => t.trim()).filter(Boolean))];
  const hits = tools.filter((t) => MEDIA_TOOLS.test(t));
  if (hits.length) {
    return {
      ...base,
      status: 'noted',
      finding: `The file names ${hits.map((t) => quote(t)).join(' and ')}, software that converts or edits video and audio.`,
      note: 'Phones and cameras usually write their own name or none. Converters and editors name themselves when they write a file, which happens when footage is trimmed, joined, compressed or changed in any way. WhatsApp also re-encodes videos it sends.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: tools.length ? `The file names ${tools.map((t) => quote(t)).join(' and ')}, which is not on the app’s list of converters and editors.` : 'The file names no encoder or editing software.',
    note: 'Many tools write no name, and names are easily removed, so this does not show the file is unchanged.',
  };
}

export function mediaTimes(m: MediaInfo): Observation {
  const base = { id: 'media.times', check: 'Recording times kept in the file', method: METHOD };
  if (!m.hasTimes) {
    return { ...base, status: 'unavailable', finding: 'This kind of file keeps no recording times.', note: 'Formats such as MP3 and WAV have no field for them.' };
  }
  if (isZero(m.creationTime)) {
    return {
      ...base,
      status: 'noted',
      finding: 'The file’s recording time is empty (set to zero).',
      note: 'Phones and cameras fill in the time when they record. Messaging apps, converters and editors often clear it when they write a new file.',
    };
  }
  if (!isZero(m.modificationTime) && Math.abs(m.modificationTime!.getTime() - m.creationTime!.getTime()) > 60_000) {
    return {
      ...base,
      status: 'noted',
      finding: `The file records it was created on ${formatIst(m.creationTime!)} and last changed on ${formatIst(m.modificationTime!)}.`,
      note: 'The two usually match for a recording straight from a phone or camera. Software that rewrites the file may update the change time. Both are set from a device clock and can be edited.',
    };
  }
  return {
    ...base,
    status: 'none',
    finding: `The file records it was created on ${formatIst(m.creationTime!)}${isZero(m.modificationTime) ? '' : ', with the same change time'}.`,
    note: 'These times come from a device clock and can be edited, so this does not show the file is unchanged.',
  };
}

const TOOL_TAGS = new Set(['©too', '©swr', 'encoder', 'ENCODER', 'encoded_by', 'TSSE', 'TENC', 'ISFT', 'com.apple.quicktime.software', 'software', 'Software']);

export async function mediaInfo(file: Blob): Promise<MediaInfo> {
  const { parseBlob } = await import('music-metadata');
  const mm = await parseBlob(file, { duration: false, skipCovers: true });
  const tools = [mm.format.tool, mm.common.encodedby, mm.common.encodersettings].filter((s): s is string => !!s);
  for (const tags of Object.values(mm.native)) {
    for (const t of tags) if (TOOL_TAGS.has(t.id) && typeof t.value === 'string') tools.push(t.value);
  }
  const container = (mm.format.container ?? '').toLowerCase();
  return {
    tools,
    creationTime: mm.format.creationTime,
    modificationTime: mm.format.modificationTime,
    hasTimes: /mp4|m4a|m4v|mov|quicktime|3gp|isom|iso|qt/.test(container) || !!mm.format.creationTime,
  };
}
