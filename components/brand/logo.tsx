import { cn } from '@/lib/utils';
import { BRAND_GREEN, BRAND_NAVY, DIGEST_HEIGHT, DIGEST_Y, MARK_DIGEST, MARK_GLYPHS } from '@/lib/brand';

/** The mark: "#63", a hash of Section 63, over a digest bar (lib/brand.ts). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill={BRAND_NAVY} />
      {MARK_GLYPHS.map((g) => (
        <path key={g.x} transform={g.transform} d={g.d} fill={g.fill} />
      ))}
      {MARK_DIGEST.map(([x, w]) => (
        <rect key={x} x={x} y={DIGEST_Y} width={w} height={DIGEST_HEIGHT} rx="1" fill={BRAND_GREEN} />
      ))}
    </svg>
  );
}
