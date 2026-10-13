'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  label: string;
  hint: string;
}

export function Stepper({
  steps,
  current,
  complete,
  onSelect,
}: {
  steps: StepDef[];
  current: number;
  complete: (step: number) => boolean;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="grid grid-cols-5 gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === current;
        const done = !active && complete(n);
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onSelect(n)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-all sm:px-4 sm:py-3.5',
                active
                  ? 'border-ink-900 bg-white shadow-lift ring-1 ring-ink-900'
                  : 'border-line bg-white/70 hover:border-line-strong hover:bg-white',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold transition-colors',
                  active ? 'bg-ink-900 text-white' : done ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span className="hidden min-w-0 lg:block">
                <span className={cn('block truncate text-[14px] font-semibold', active ? 'text-ink-950' : 'text-ink-700')}>{s.label}</span>
                <span className="block truncate text-[12px] text-ink-500">{s.hint}</span>
              </span>
              <span className={cn('hidden truncate text-[13px] font-semibold sm:block lg:hidden', active ? 'text-ink-950' : 'text-ink-600')}>
                {s.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
