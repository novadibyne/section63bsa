import { cn } from '@/lib/utils';

/** Seal-style mark: a navy tile with "63" and an emerald verification notch. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0d1b3e" />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans Variable', system-ui, sans-serif"
        fontWeight="800"
        fontSize="15"
        letterSpacing="-0.5"
        fill="#ffffff"
      >
        63
      </text>
      <circle cx="31.5" cy="8.5" r="5.5" fill="#12a873" stroke="#0d1b3e" strokeWidth="2" />
      <path d="M29.2 8.6 L30.8 10.1 L33.8 7" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
