import { ChevronDown } from 'lucide-react';
import { FAQS, FAQ_JSON_LD } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';

/** Common questions about the certificate, folded so the page stays short. Also marked up for search engines. */
export function Faq() {
  return (
    <section id="faq" className="pt-10">
      <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">Common questions</h2>
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group px-4 sm:px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14.5px] font-semibold text-ink-950 [&::-webkit-details-marker]:hidden">
              <h3>{q}</h3>
              <ChevronDown className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="-mt-1 pb-4 text-[14px] leading-relaxed text-ink-600">{a}</p>
          </details>
        ))}
      </div>
      <JsonLd data={FAQ_JSON_LD} />
    </section>
  );
}
