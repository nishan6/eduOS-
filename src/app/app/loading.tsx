export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-2 h-7 w-56 rounded bg-surface-muted" />
      <div className="mb-8 h-4 w-80 rounded bg-surface-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-card bg-surface-muted" />)}
      </div>
      <div className="mt-6 h-64 rounded-card bg-surface-muted" />
    </div>
  );
}
