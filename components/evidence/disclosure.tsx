'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A titled section that opens and closes, used on file cards. */
export function Disclosure({
  title,
  icon,
  children,
  defaultOpen,
  testId,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-line" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-800 hover:bg-ink-50/70"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-ink-500">
          {icon}
          {title}
        </span>
        <ChevronDown className={cn('size-4 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line p-3.5">{children}</div>}
    </div>
  );
}
