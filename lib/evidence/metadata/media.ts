import { formatDuration } from '@/lib/utils';
import { formatIst } from '@/lib/time';
import type { MetaRow } from './index';

function probeElement(file: Blob, kind: 'audio' | 'video'): Promise<{ duration?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const done = (v: { duration?: number; width?: number; height?: number }) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      resolve(v);
    };
    const timer = setTimeout(() => done({}), 8000);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement;
      done({
        duration: Number.isFinite(el.duration) ? el.duration : undefined,
        width: kind === 'video' ? v.videoWidth || undefined : undefined,
        height: kind === 'video' ? v.videoHeight || undefined : undefined,
      });
    };
    el.onerror = () => done({});
    el.src = url;
  });
}

export async function mediaMetadata(file: Blob, kind: 'audio' | 'video') {
  const summary: MetaRow[] = [];
  type Fmt = {
    container?: string;
    codec?: string;
    bitrate?: number;
    sampleRate?: number;
    numberOfChannels?: number;
    duration?: number;
    creationTime?: Date;
  };
  let format: Fmt | undefined;
  let common: { title?: string; artist?: string; encodedby?: string; date?: string } | undefined;
  try {
    const { parseBlob } = await import('music-metadata');
    const mm = await parseBlob(file, { duration: false, skipCovers: true });
    format = mm.format as Fmt;
    common = mm.common as typeof common;
  } catch {
    format = undefined;
  }
  const el = await probeElement(file, kind);
  const duration = el.duration ?? format?.duration;

  if (duration) summary.push({ label: 'Duration', value: formatDuration(duration)! });
  if (el.width && el.height) summary.push({ label: 'Resolution', value: `${el.width} × ${el.height}` });
  if (format?.container) summary.push({ label: 'Container', value: format.container });
  if (format?.codec) summary.push({ label: 'Codec', value: format.codec });
  if (format?.bitrate) summary.push({ label: 'Bitrate', value: `${Math.round(format.bitrate / 1000)} kbps` });
  if (format?.sampleRate) summary.push({ label: 'Sample rate', value: `${format.sampleRate} Hz` });
  if (format?.numberOfChannels) summary.push({ label: 'Channels', value: String(format.numberOfChannels) });
  if (format?.creationTime && !Number.isNaN(new Date(format.creationTime).getTime()))
    summary.push({ label: 'Created (container)', value: formatIst(new Date(format.creationTime)) });
  if (common?.date) summary.push({ label: 'Recorded', value: common.date });
  if (common?.encodedby) summary.push({ label: 'Encoder', value: common.encodedby });
  if (common?.title) summary.push({ label: 'Title tag', value: common.title });
  if (!summary.length) summary.push({ label: 'Media details', value: 'Not readable in this browser' });
  return { summary };
}
