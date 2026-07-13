export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-surface-raised/30 border border-line rounded-2xl p-6">
        <div className="h-7 bg-line rounded w-64 mb-2" />
        <div className="h-3 bg-line rounded w-96" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface-raised/30 border border-line rounded-2xl p-6 h-36">
            <div className="h-3 bg-line rounded w-28 mb-4" />
            <div className="h-10 bg-line rounded w-16 mt-auto" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-surface-raised/30 border border-line rounded-2xl p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-line rounded w-1/4" />
            <div className="h-4 bg-line rounded w-1/3" />
            <div className="h-4 bg-line rounded w-1/5 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
