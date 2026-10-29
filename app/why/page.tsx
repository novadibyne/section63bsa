import { BookOpenText, Plus, Scale } from 'lucide-react';
import { BARE_ACT_URL } from '@/lib/config';
import { SECTION_63_4, SECTION_63_GUIDE } from '@/lib/legal/section-63';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Callout, PageHeader } from '@/components/ui/misc';
import { CertificateTimeline, WhatItMeans } from '@/components/why-column';

export const metadata = { title: 'Why the certificate matters' };

export default function WhyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Why this certificate matters"
        title="From Section 65B to Section 63 BSA"
        description="Courts will not accept a copy of digital evidence without a proper certificate. Here is how that rule came about, in plain words."
        actions={
          <ButtonLink href="/evidence/new/" variant="brand">
            <Plus /> Make a certificate
          </ButtonLink>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardBody className="py-7 pl-9 sm:pl-10">
            <CertificateTimeline full />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          <WhatItMeans />
          <Callout tone="neutral" icon={<Scale />}>
            These are short summaries to help you understand the rule, not legal advice. Read the judgments and the{' '}
            <a href={BARE_ACT_URL} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              bare Act
            </a>
            , and ask your lawyer about your case.
          </Callout>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader icon={<BookOpenText />} title="Section 63 in short" description="Plain-language summaries. The Act’s own words follow." />
        <CardBody className="flex flex-col gap-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            {SECTION_63_GUIDE.map((g) => (
              <div key={g.ref} className="rounded-xl bg-ink-50/70 p-3.5">
                <dt className="font-mono text-[12px] font-semibold text-brand-700">s.{g.ref}</dt>
                <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-700">{g.summary}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-[13px] font-semibold text-ink-800">Section 63(4), word for word</p>
            <blockquote className="mt-2 border-l-2 border-line-strong pl-4 font-serif text-[14.5px] leading-relaxed whitespace-pre-line text-ink-800">
              {SECTION_63_4}
            </blockquote>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
