import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Page not found', path: '/404/', index: false });

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you were looking for does not exist."
        action={<ButtonLink href="/">Go to dashboard</ButtonLink>}
      />
    </div>
  );
}
