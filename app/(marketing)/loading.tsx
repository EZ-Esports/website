export default function MarketingLoading() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center gap-6 bg-background"
      aria-live="polite"
      aria-label="Loading page content"
    >
      {/* Animated brand bars */}
      <div className="flex items-end gap-1.5 h-10" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-ez-pink/60 animate-pulse motion-reduce:animate-none"
            style={{
              height: `${40 + i * 8}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
        {[3, 2, 1, 0].map((i) => (
          <div
            key={`r${i}`}
            className="w-1.5 rounded-full bg-ez-pink/60 animate-pulse motion-reduce:animate-none"
            style={{
              height: `${40 + i * 8}%`,
              animationDelay: `${(5 + (3 - i)) * 0.1}s`,
            }}
          />
        ))}
      </div>
      <p className="text-foreground-secondary text-sm font-medium tracking-wide">Loading…</p>
    </div>
  );
}
