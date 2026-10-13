import { Check } from 'lucide-react';
import { BLANK, SCHEDULE_HEADING, type Line, type PartValues, type SchedulePart, type Seg } from '@/lib/legal/schedule-63';
import { cn } from '@/lib/utils';

function SegView({ seg, values }: { seg: Seg; values: PartValues }) {
  if (typeof seg === 'string') return <>{seg}</>;
  if ('field' in seg) {
    const v = values.fields[seg.field]?.trim();
    if (!v) return seg.blank === '' ? null : <span className="text-ink-300">{seg.blank ?? BLANK}</span>;
    return (
      <>
        {seg.lead}
        <mark
          className={cn(
            'rounded-[3px] bg-brand-50 px-0.5 font-semibold text-ink-950 decoration-brand-400/70 underline-offset-[3px] [box-decoration-break:clone]',
            seg.field === 'hashValues' ? 'font-mono text-[12px] break-all' : 'underline',
          )}
        >
          {v}
        </mark>
      </>
    );
  }
  if ('box' in seg) {
    const on = values.boxes[seg.box].has(seg.key);
    return (
      <span className="mr-5 inline-flex items-center gap-1.5 whitespace-nowrap">
        {seg.label}
        <span
          className={cn(
            'inline-flex size-[15px] items-center justify-center rounded-[3px] border',
            on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-400 bg-white',
          )}
          aria-label={on ? 'ticked' : 'not ticked'}
        >
          {on && <Check className="size-3" strokeWidth={3.5} />}
        </span>
      </span>
    );
  }
  return null;
}

function LineView({ line, values }: { line: Line; values: PartValues }) {
  const sig = line.find((x) => typeof x === 'object' && 'signature' in x) as { signature: string } | undefined;
  if (sig) {
    return (
      <div className="mt-6 mb-3 ml-auto w-60 text-[13.5px]">
        <div className="h-10" />
        <div className="border-b border-ink-800" />
        {(values.signatureLines ?? []).map((l, i) => (
          <p key={i} className={i === 0 ? 'mt-1 font-semibold' : undefined}>
            {l}
          </p>
        ))}
        <p>{sig.signature}</p>
      </div>
    );
  }
  return (
    <p>
      {line.map((seg, i) =>
        typeof seg === 'string' && /^\s+$/.test(seg) ? null : <SegView key={i} seg={seg} values={values} />,
      )}
    </p>
  );
}

export function SchedulePreview({ part, values, showHeading }: { part: SchedulePart; values: PartValues; showHeading?: boolean }) {
  return (
    <div className="relative mx-auto max-w-[720px] rounded-md bg-sheet px-6 py-8 font-serif text-[14.5px] leading-[1.7] text-ink-950 shadow-sheet ring-1 ring-line sm:px-12 sm:py-12">
      {showHeading && (
        <div className="mb-2 text-center">
          <p className="font-bold tracking-[0.12em]">{SCHEDULE_HEADING[0]}</p>
          <p className="text-[13px] text-ink-600">{SCHEDULE_HEADING[1]}</p>
          <p className="mt-1 font-bold tracking-[0.3em]">{SCHEDULE_HEADING[2]}</p>
        </div>
      )}
      <p className="mt-4 text-center font-bold tracking-wider">{part.title}</p>
      <p className="mb-6 text-center text-[13.5px] text-ink-600 italic">{part.subtitle}</p>
      <div className="flex flex-col gap-3.5">
        {part.paragraphs.map((p, i) => (
          <div key={i} className="flex flex-col gap-1">
            {p.map((line, j) => (
              <LineView key={j} line={line} values={values} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
