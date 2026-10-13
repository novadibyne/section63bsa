import { formatInTimeZone } from 'date-fns-tz';

export const IST = 'Asia/Kolkata';

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in IST as yyyy-MM-dd (the value format of <input type="date">). */
export function istDateInput(d: Date = new Date()): string {
  return formatInTimeZone(d, IST, 'yyyy-MM-dd');
}

/** Current time in IST as HH:mm, 24-hour (the value format of <input type="time">). */
export function istTimeInput(d: Date = new Date()): string {
  return formatInTimeZone(d, IST, 'HH:mm');
}

/** yyyy-MM-dd → DD/MM/YYYY, as the Schedule requires. */
export function toDMY(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

/** Any ISO timestamp → "DD/MM/YYYY HH:mm IST". */
export function formatIst(iso: string | Date | undefined): string {
  if (!iso) return '';
  return `${formatInTimeZone(typeof iso === 'string' ? new Date(iso) : iso, IST, 'dd/MM/yyyy HH:mm')} IST`;
}

export function formatIstSeconds(iso: string | Date | undefined): string {
  if (!iso) return '';
  return `${formatInTimeZone(typeof iso === 'string' ? new Date(iso) : iso, IST, 'dd/MM/yyyy HH:mm:ss')} IST`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatIst(iso).replace(/ \d{2}:\d{2} IST$/, '');
}
