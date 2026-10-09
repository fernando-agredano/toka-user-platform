export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-sm bg-line ${className}`} />
);
