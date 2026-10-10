type LogoSize = 'md' | 'lg';

const SIZE_CLASSES: Record<LogoSize, string> = { md: 'text-3xl', lg: 'text-5xl' };

/** Brand wordmark. */
export const Logo = ({ size = 'md', className = '' }: { size?: LogoSize; className?: string }) => (
  <span className={`font-bold tracking-tight text-primary ${SIZE_CLASSES[size]} ${className}`}>Toka</span>
);
