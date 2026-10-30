'use client';

import * as React from 'react';
import { Download, FileArchive, Info, MessagesSquare, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EvidenceFile } from '@/lib/types';
import type { MetaRow } from '@/lib/evidence/metadata';
import type { ChatSummary } from '@/lib/evidence/metadata/whatsapp';
import { KIND_LABEL } from '@/lib/evidence/detect';
import { getFileBlob, removeFile, reverifyFile, setAcquisitionHash } from '@/lib/actions';
import { cn, downloadBlob, formatBytes } from '@/lib/utils';
import { formatIst } from '@/lib/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { HashLine, Progress } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/dialog';
import { KindIcon } from './kind';
import { ChatPreview } from './chat-preview';
import { Disclosure } from './disclosure';
import { FileObservationsPanel } from './file-observations';

function MetaList({ rows }: { rows: MetaRow[] }) {
  return (
    <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-xl bg-ink-50/60 px-3.5 py-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <div key={i} className="flex min-w-0 gap-2 text-[12.5px]">
          <dt className="w-32 shrink-0 text-ink-500">{r.label}</dt>
          <dd className="min-w-0 break-words font-medium text-ink-800">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FileCard({ file, editable = true, full = false }: { file: EvidenceFile; editable?: boolean; full?: boolean }) {
  const [verifying, setVerifying] = React.useState<number | null>(null);
  const [acq, setAcq] = React.useState(file.acquisitionHash ?? '');
  const picker = React.useRef<HTMLInputElement>(null);
  const { confirm, element } = useConfirm();
  const summary = (file.metadata.summary as MetaRow[] | undefined) ?? [];
  const chat = file.metadata.chat as ChatSummary | undefined;

  const verify = async (source?: File) => {
    setVerifying(0);
    try {
      const r = await reverifyFile(file.id, source, (p) => setVerifying(p));
      if (r.match) toast.success('Hashes match', { description: 'The file is identical to the one originally hashed.' });
      else toast.error('Hashes do NOT match', { description: 'This file differs from the one originally hashed.' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not re-verify');
    } finally {
      setVerifying(null);
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-white shadow-card" data-testid="file-card">
      {element}
      <div className="flex items-start gap-3.5 px-4 pt-4 sm:px-5">
        <KindIcon kind={file.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="min-w-0 truncate text-[14.5px] font-semibold text-ink-950" title={file.originalFilename}>
              {file.originalFilename}
            </h4>
            <Badge tone="neutral">{KIND_LABEL[file.kind]}</Badge>
            {file.lastVerifiedAt &&
              (file.lastVerifiedMatch ? (
                <Badge tone="brand">
                  <ShieldCheck /> Re-verified
                </Badge>
              ) : (
                <Badge tone="red">
                  <ShieldAlert /> Mismatch
                </Badge>
              ))}
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            {formatBytes(file.sizeBytes)} · {file.detectedMime ?? 'unknown type'} · hashed {formatIst(file.hashedAt)}
            {!file.blobStored && ' · hashes only (no stored copy)'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={file.blobStored ? 'Re-verify stored copy' : 'Re-verify against the original file'}
            aria-label="Re-verify"
            onClick={() => (file.blobStored ? verify() : picker.current?.click())}
            disabled={verifying != null}
          >
            <RefreshCw className={cn(verifying != null && 'animate-spin')} />
          </Button>
          {file.blobStored && full && (
            <Button
              variant="ghost"
              size="icon"
              title="Download stored copy"
              aria-label="Download stored copy"
              onClick={async () => {
                const b = await getFileBlob(file.id);
                if (b) downloadBlob(b, file.originalFilename);
              }}
            >
              <Download />
            </Button>
          )}
          {editable && (
            <Button
              variant="ghost"
              size="icon"
              title="Remove file"
              aria-label="Remove file"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Remove this file?',
                    description: `${file.originalFilename} and its hashes will be removed from this evidence record. The audit log keeps a record of the removal.`,
                    confirmLabel: 'Remove',
                    danger: true,
                  })
                ) {
                  await removeFile(file.id);
                  toast('File removed');
                }
              }}
            >
              <Trash2 />
            </Button>
          )}
          <input ref={picker} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && verify(e.target.files[0])} />
        </div>
      </div>

      {verifying != null && (
        <div className="px-5 pt-3">
          <Progress value={verifying} />
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 pt-3.5 pb-4 sm:px-5">
        <HashLine algo="SHA-256" value={file.sha256} emphasise />

        {summary.length > 0 &&
          (full ? (
            <MetaList rows={summary} />
          ) : (
            <Disclosure title="Technical details read from the file" icon={<Info />}>
              <MetaList rows={summary} />
            </Disclosure>
          ))}

        {chat && chat.preview.length > 0 && (
          <Disclosure title={`Preview chat (${chat.messageCount} messages)`} icon={<MessagesSquare />} defaultOpen={full}>
            <ChatPreview chat={chat} />
          </Disclosure>
        )}

        <FileObservationsPanel file={file} />

        {file.members && file.members.length > 0 && (
          <Disclosure title={`${file.members.length} files inside the archive, each hashed`} icon={<FileArchive />}>
            <ul className="flex max-h-72 flex-col divide-y divide-line overflow-auto">
              {file.members.map((m) => (
                <li key={m.name} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-56 shrink-0 truncate text-[12.5px] text-ink-800" title={m.name}>
                    {m.name}
                  </span>
                  <span className="w-16 shrink-0 text-[12px] text-ink-500">{formatBytes(m.sizeBytes)}</span>
                  <span className="hash min-w-0 text-[11.5px] text-ink-600">{m.sha256}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        {full && (
          <div className="mt-1 rounded-xl border border-line p-3.5">
            <p className="text-[13px] font-medium text-ink-800">SHA-256 recorded at acquisition (optional)</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
              If the expert or party hashed the original when collecting it, paste that SHA-256. It is compared with this file and
              reported in the Hash Report.
            </p>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <Input
                value={acq}
                onChange={(e) => setAcq(e.target.value)}
                placeholder="Paste a SHA-256 value (64 characters)"
                className="font-mono text-[12.5px]"
                disabled={!editable}
              />
              <Button
                variant="secondary"
                disabled={!editable}
                onClick={async () => {
                  const r = await setAcquisitionHash(file.id, acq);
                  if (!r) toast('Acquisition hash cleared');
                  else if (!r.valid) toast.error('That is not a SHA-256 value', { description: 'A SHA-256 is 64 characters, 0–9 and a–f.' });
                  else if (r.match) toast.success('Matches the computed SHA-256');
                  else toast.error('Does not match the computed SHA-256');
                }}
              >
                Compare
              </Button>
            </div>
            {file.acquisitionHash && (
              <p className={cn('mt-2 text-[12.5px] font-medium', file.acquisitionHashMatch ? 'text-brand-700' : 'text-red-600')}>
                {file.acquisitionHashMatch ? '✓ Matches the computed SHA-256' : '✕ Does not match the computed SHA-256'}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
