'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          toast.error('Could not copy to clipboard');
        }
      }}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-[width] duration-200"
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function HashLine({ algo, value, emphasise }: { algo: string; value: string; emphasise?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg px-3 py-2', emphasise ? 'bg-brand-50/70 ring-1 ring-brand-100' : 'bg-ink-50')}>
      <span
        className={cn(
          'mt-0.5 w-16 shrink-0 font-mono text-[10.5px] font-semibold tracking-wider uppercase',
          emphasise ? 'text-brand-700' : 'text-ink-500',
        )}
      >
        {algo}
      </span>
      <span className="hash min-w-0 flex-1">{value}</span>
      <CopyButton value={value} label={`Copy ${algo}`} className="-my-1" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-500 ring-1 ring-line [&_svg]:size-5">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-ink-950">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = 'neutral',
  icon,
  title,
  children,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'amber' | 'red';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-50 border-line text-ink-700',
    brand: 'bg-brand-50 border-brand-200 text-brand-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed', tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
