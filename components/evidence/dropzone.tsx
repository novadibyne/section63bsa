'use client';

import * as React from 'react';
import { CloudUpload, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { addFile, storageEstimate, type AddProgress } from '@/lib/actions';
import { PRIVACY_BADGE } from '@/lib/config';
import { cn, formatBytes } from '@/lib/utils';
import { Progress } from '@/components/ui/misc';
import { Toggle } from '@/components/ui/form';
import { Button } from '@/components/ui/button';

interface QueueItem {
  key: string;
  name: string;
  size: number;
  p: AddProgress;
}

const STAGE_LABEL: Record<AddProgress['stage'], string> = {
  queued: 'Waiting',
  detecting: 'Detecting file type',
  hashing: 'Computing SHA-256',
  reading: 'Reading metadata',
  saving: 'Saving',
  done: 'Done',
  error: 'Failed',
};

export function Dropzone({ evidenceId, compact }: { evidenceId: string; compact?: boolean }) {
  const [keepCopy, setKeepCopy] = React.useState(true);
  const [dragging, setDragging] = React.useState(false);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const input = React.useRef<HTMLInputElement>(null);
  const busy = queue.some((q) => q.p.stage !== 'done' && q.p.stage !== 'error');

  const update = (key: string, p: AddProgress) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, p } : x)));

  const onFiles = async (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => f.size >= 0);
    if (!files.length) return;
    const items = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, size: f.size, p: { stage: 'queued' as const } }));
    setQueue((q) => [...q, ...items]);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = items[i].key;
      let store = keepCopy;
      if (store) {
        const est = await storageEstimate();
        if (est && est.quota && est.usage + f.size > est.quota * 0.9) {
          store = false;
          toast.warning(`Not enough browser storage to keep a copy of ${f.name}`, {
            description: 'Its hashes and details are saved. Keep the original file safe yourself.',
          });
        }
      }
      try {
        const rec = await addFile(evidenceId, f, store, (p) => update(key, p));
        toast.success(`${f.name} hashed`, { description: `SHA-256 ${rec.sha256.slice(0, 16)}…` });
        setTimeout(() => setQueue((q) => q.filter((x) => x.key !== key)), 900);
      } catch (err) {
        update(key, { stage: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all',
          compact ? 'px-6 py-7' : 'px-6 py-12',
          dragging ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-100' : 'border-line-strong bg-ink-50/40 hover:border-ink-300 hover:bg-white',
        )}
      >
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-2xl bg-white text-ink-700 shadow-card ring-1 ring-line transition-transform group-hover:-translate-y-0.5',
            dragging && 'text-brand-600',
          )}
        >
          <CloudUpload className="size-5" />
        </div>
        <p className="mt-4 font-display text-[16px] font-semibold text-ink-950">
          {dragging ? 'Drop to hash' : compact ? 'Add more files' : 'Drop evidence files here'}
        </p>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-500">
          Photos, screenshots, audio, video, PDFs, emails (.eml) or a WhatsApp export (.txt or .zip). Any file type works.
        </p>
        <span className="mt-4 inline-flex h-9 items-center rounded-xl bg-ink-900 px-4 text-[13px] font-medium text-white shadow-sm group-hover:bg-ink-800">
          Choose files
        </span>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files) void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Toggle id="keep-copy" checked={keepCopy} onChange={setKeepCopy} label="Keep a copy of each file in this browser" />
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-800">
          <Lock className="size-3.5 text-brand-600" />
          {PRIVACY_BADGE}: files never leave this device.
        </span>
      </div>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {queue.map((q) => (
            <li key={q.key} className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink-900">{q.name}</p>
                  <p className={cn('text-[12px]', q.p.stage === 'error' ? 'text-red-600' : 'text-ink-500')}>
                    {formatBytes(q.size)} · {q.p.stage === 'error' ? q.p.error : STAGE_LABEL[q.p.stage]}
                    {q.p.stage === 'hashing' && q.p.progress != null && ` · ${Math.round(q.p.progress * 100)}%`}
                  </p>
                </div>
                {q.p.stage === 'error' && (
                  <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setQueue((x) => x.filter((y) => y.key !== q.key))}>
                    <X />
                  </Button>
                )}
              </div>
              {q.p.stage !== 'error' && (
                <Progress
                  className="mt-2"
                  value={
                    q.p.stage === 'hashing'
                      ? 0.05 + (q.p.progress ?? 0) * 0.8
                      : ({ queued: 0, detecting: 0.03, reading: 0.9, saving: 0.96, done: 1 } as Record<string, number>)[q.p.stage] ?? 0
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {busy && <span className="sr-only">Processing files</span>}
    </div>
  );
}
