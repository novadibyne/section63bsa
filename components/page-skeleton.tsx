export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-40 rounded bg-ink-100" />
      <div className="mt-4 h-9 w-2/3 rounded-lg bg-ink-100" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-40 rounded-2xl bg-ink-100/70" />
        <div className="h-40 rounded-2xl bg-ink-100/70" />
        <div className="h-40 rounded-2xl bg-ink-100/70" />
      </div>
    </div>
  );
}
