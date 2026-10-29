'use client';

import { Check, Info, Stamp, UserRound, UserRoundCog } from 'lucide-react';
import type { CertificateParts } from '@/lib/types';
import { cn } from '@/lib/utils';

const OPTIONS: { value: CertificateParts; title: string; text: string; icon: typeof Stamp }[] = [
  {
    value: 'both',
    title: 'Part A and Part B',
    text: 'The full certificate: your declaration and the expert’s. Choose this if you are not sure.',
    icon: Stamp,
  },
  {
    value: 'A',
    title: 'Only Part A',
    text: 'Your declaration, as the person who owns or looks after the device. The expert gives Part B separately.',
    icon: UserRound,
  },
  {
    value: 'B',
    title: 'Only Part B',
    text: 'The expert’s declaration. For experts, or when Part A is made separately.',
    icon: UserRoundCog,
  },
];

/** Big tappable cards to pick which parts of the Schedule to make. */
export function PartsChoice({
  value,
  onChange,
  disabled,
  className,
}: {
  value: CertificateParts;
  onChange: (v: CertificateParts) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div role="radiogroup" aria-label="Which parts to make" className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              data-testid={`parts-${o.value}`}
              className={cn(
                'relative flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition-all sm:flex-col sm:gap-2.5',
                on ? 'border-brand-500 ring-4 ring-brand-100' : 'border-line-strong hover:border-ink-300',
                disabled && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]',
                  on ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-700 ring-1 ring-line',
                )}
              >
                <o.icon />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold text-ink-950">{o.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-600">{o.text}</span>
              </span>
              {on && (
                <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {value !== 'both' && (
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-500">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          The court needs both parts with the record (Section 63(4)). Make one part here when the other is being prepared separately, and
          file them together.
        </p>
      )}
    </div>
  );
}
