const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const SIZE_CLASSES = { md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-base' };

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export const Avatar = ({ name, size = 'md', className = '' }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 items-center justify-center rounded-full border-2 border-transparent bg-primary-soft font-semibold text-primary ${SIZE_CLASSES[size]} ${className}`}
  >
    {initialsOf(name) || '?'}
  </span>
);
