import { Mail } from 'lucide-react';
import { APP_NAME, CONTACT_EMAIL } from '@/lib/config';
import { cn } from '@/lib/utils';

/** The contact email as a link that opens the visitor's email app. */
export function ContactEmail({ className, icon = true }: { className?: string; icon?: boolean }) {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(APP_NAME)}`}
      className={cn('inline-flex items-center gap-1.5 font-semibold break-all text-brand-700 hover:underline', className)}
      data-testid="contact-email"
    >
      {icon && <Mail className="size-4 shrink-0" />}
      {CONTACT_EMAIL}
    </a>
  );
}

/** A "Questions or feedback?" box with the contact email, for the end of a page. */
export function ContactCard({ title = 'Questions or feedback?', text = 'Email us about the app, a problem you found or your data.', className }: { title?: string; text?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5', className)}>
      <div className="flex gap-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Mail className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink-950">{title}</h2>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-600">{text}</p>
        </div>
      </div>
      <ContactEmail className="pl-[3.125rem] text-[14.5px] sm:pl-0" />
    </div>
  );
}
