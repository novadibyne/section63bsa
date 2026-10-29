import type { Certificate, CertificateParts } from '@/lib/types';

export const PARTS_LABEL: Record<CertificateParts, string> = {
  both: 'Part A and Part B',
  A: 'Part A only',
  B: 'Part B only',
};

export const partsOf = (cert?: Pick<Certificate, 'parts'>): CertificateParts => cert?.parts ?? 'both';

export const hasPart = (cert: Pick<Certificate, 'parts'> | undefined, part: 'A' | 'B'): boolean => {
  const p = partsOf(cert);
  return p === 'both' || p === part;
};

/** Who must sign, for the PDF footer and the next-steps notes. */
export function signersText(parts: CertificateParts): string {
  if (parts === 'A') return 'the declarant (Part A)';
  if (parts === 'B') return 'the expert (Part B)';
  return 'the declarant (Part A) and the expert (Part B)';
}
