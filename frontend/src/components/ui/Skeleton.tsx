export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-sm bg-line ${className}`} />
);

/** A stack of identical placeholders, for lists whose rows are not known yet. */
export const SkeletonList = ({ count, itemClassName }: { count: number; itemClassName: string }) => (
  <div className="space-y-3">
    {Array.from({ length: count }, (_, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
      <Skeleton key={index} className={itemClassName} />
    ))}
  </div>
);
