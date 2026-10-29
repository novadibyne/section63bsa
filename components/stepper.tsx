'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  id: number;
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
  /** id of the current step */
  current: number;
  complete: (id: number) => boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <ol className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const active = s.id === current;
        const done = !active && complete(s.id);
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s.label}`}
              className={cn(
                'group flex w-full items-center justify-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-all sm:justify-start sm:px-4 sm:py-3.5',
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
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
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
