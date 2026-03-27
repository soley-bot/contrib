/** Skeleton placeholder for task board loading state */

function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-xl p-3.5 mb-2.5 animate-pulse">
      <div className="h-4 bg-border rounded w-3/4 mb-3" />
      <div className="h-3 bg-bg-hover rounded w-1/2 mb-3" />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-border" />
        <div className="h-3 bg-bg-hover rounded w-20" />
      </div>
    </div>
  );
}

function SkeletonColumn({ label }: { label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-full w-fit bg-bg-hover">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

/** Stats row skeleton */
function SkeletonStats() {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 bg-white border border-border rounded-xl px-3.5 py-2.5 min-w-[80px] animate-pulse">
          <div className="h-5 bg-border rounded w-8 mb-2" />
          <div className="h-3 bg-bg-hover rounded w-14" />
        </div>
      ))}
    </div>
  );
}

/** Mobile flat list skeleton */
function SkeletonMobileList() {
  return (
    <div className="md:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Desktop kanban skeleton */
function SkeletonKanban() {
  return (
    <div className="hidden md:grid grid-cols-3 gap-4">
      <SkeletonColumn label="To Do" />
      <SkeletonColumn label="In Progress" />
      <SkeletonColumn label="Done" />
    </div>
  );
}

export default function TaskBoardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-4">
      <SkeletonStats />
      <SkeletonMobileList />
      <SkeletonKanban />
    </div>
  );
}
