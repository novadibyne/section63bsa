'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl border border-line bg-white p-0 text-ink-900 shadow-lift"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">{title}</h2>
          {description && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{description}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      {children && <div className="px-6 pt-4">{children}</div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line bg-ink-50/60 px-6 py-4">{footer}</div>
    </dialog>
  );
}

export function useConfirm() {
  const [state, setState] = React.useState<{
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    resolve?: (v: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback(
    (opts: { title: string; description?: React.ReactNode; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    state?.resolve?.(v);
    setState(null);
  };

  const element = (
    <Dialog
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ''}
      description={state?.description}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    />
  );

  return { confirm, element };
}
