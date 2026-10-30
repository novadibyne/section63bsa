import { pageMetadata } from '@/lib/seo';

// A screen of the user's own records: nothing here for search engines.
export const metadata = pageMetadata({ title: 'Activity log', path: '/audit/', index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
