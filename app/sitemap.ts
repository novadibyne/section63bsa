import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export const dynamic = 'force-static';

/** The pages worth finding in a search engine. The user's own records (My certificates, Settings…) are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ['/', 1],
    ['/evidence/new/', 0.8],
    ['/why/', 0.8],
    ['/privacy/', 0.5],
  ];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, lastModified: new Date(), changeFrequency: 'monthly', priority }));
}
