import { Home } from '@/components/home';
import { pageMetadata, SEO_TITLE } from '@/lib/seo';

export const metadata = pageMetadata({ title: SEO_TITLE, path: '/' });

export default function HomePage() {
  return <Home />;
}
