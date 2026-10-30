import { pageMetadata } from '@/lib/seo';

// Shown in search results.
export const metadata = pageMetadata({
  title: 'Start a Section 63 BSA certificate',
  description:
    'Start a Section 63 BSA certificate for electronic evidence: choose Part A, Part B or both, add your files and get the SHA-256 hash report. Free, in your browser.',
  path: '/evidence/new/',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
