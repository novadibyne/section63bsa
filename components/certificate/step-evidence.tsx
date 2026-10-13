'use client';

import * as React from 'react';
import { FileStack, Gavel, NotebookPen, Sparkles } from 'lucide-react';
import type { Evidence, EvidenceFile } from '@/lib/types';
import { updateEvidence } from '@/lib/actions';
import { useAutosave } from '@/lib/hooks';
import { MANNER_EXAMPLES } from '@/lib/legal/section-63';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Dropzone } from '@/components/evidence/dropzone';
import { FileCard } from '@/components/evidence/file-card';
import { EmptyState } from '@/components/ui/misc';

type Form = Pick<Evidence, 'title' | 'description' | 'mannerOfProduction' | 'courtName' | 'caseNumber'>;

export function StepEvidence({ evidence, files }: { evidence: Evidence; files: EvidenceFile[] }) {
  const pick = (e: Evidence): Form => ({
    title: e.title,
    description: e.description ?? '',
    mannerOfProduction: e.mannerOfProduction ?? '',
    courtName: e.courtName ?? '',
    caseNumber: e.caseNumber ?? '',
  });
  const [form, setForm] = useAutosave<Form>(evidence.id, pick(evidence), (v) => updateEvidence(evidence.id, v));

  // Title is suggested from the first file; keep the form in step when that happens.
  const lastTitle = React.useRef(evidence.title);
  React.useEffect(() => {
    if (evidence.title !== lastTitle.current) {
      lastTitle.current = evidence.title;
      setForm((f) => ({ ...f, title: evidence.title }));
    }
  }, [evidence.title, setForm]);

  if (!form) return null;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader
          icon={<FileStack />}
          title="Evidence files"
          description="Each file gets its SHA-256 hash the moment you add it."
        />
        <CardBody className="flex flex-col gap-4">
          <Dropzone evidenceId={evidence.id} compact={files.length > 0} />
          {files.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title="No files yet"
              description="Add the screenshots, recordings, chat export or documents you want to produce in court."
              className="py-6"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {files.map((f) => (
                <FileCard key={f.id} file={f} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader icon={<NotebookPen />} title="About this record" description="Identifies the electronic record, as s.63(4)(a) requires." />
          <CardBody className="flex flex-col gap-4">
            <Field label="Title" htmlFor="ev-title" hint="For your reference; printed on the Hash Report.">
              <Input id="ev-title" value={form.title} onChange={set('title')} />
            </Field>
            <Field
              label="How was this record produced?"
              htmlFor="ev-manner"
              required
              hint="Describe exactly how the copy was made: which device, which menu or tool, and when."
            >
              <Textarea id="ev-manner" rows={4} value={form.mannerOfProduction} onChange={set('mannerOfProduction')} placeholder="e.g. Exported via WhatsApp › Export chat on the phone described in step 2, on 12/10/2026" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {MANNER_EXAMPLES.slice(0, 3).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mannerOfProduction: ex }))}
                  className="rounded-lg border border-line bg-ink-50/60 px-2.5 py-1 text-left text-[12px] leading-snug text-ink-600 hover:border-ink-300 hover:bg-white hover:text-ink-900"
                >
                  {ex.length > 64 ? `${ex.slice(0, 62)}…` : ex}
                </button>
              ))}
            </div>
            <Field label="Description (optional)" htmlFor="ev-desc">
              <Textarea id="ev-desc" rows={2} value={form.description} onChange={set('description')} placeholder="What the record shows" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Gavel />}
            title="Where it will be filed"
            description="A certificate is needed each time the record is submitted, so note the proceeding."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Court / proceeding" htmlFor="ev-court">
              <Input id="ev-court" value={form.courtName} onChange={set('courtName')} placeholder="e.g. Civil Judge (Sr. Div.), Pune" />
            </Field>
            <Field label="Case number" htmlFor="ev-case">
              <Input id="ev-case" value={form.caseNumber} onChange={set('caseNumber')} placeholder="e.g. RCS 123/2026" />
            </Field>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
