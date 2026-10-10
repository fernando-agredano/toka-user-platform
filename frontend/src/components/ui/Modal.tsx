import { type ReactNode, useEffect } from 'react';
import { Icon } from './Icon';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, string> = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

interface ModalProps {
  title: string;
  onClose: () => void;
  size?: Size;
  /** Optional emblem shown above the title (e.g. the confirmation icon). */
  icon?: ReactNode;
  children: ReactNode;
}

export const Modal = ({ title, onClose, size = 'md', icon, children }: ModalProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        className={`relative m-0 max-h-[calc(100dvh-2rem)] w-full animate-pop-in overflow-y-auto rounded-xl bg-card p-8 text-ink shadow-xl motion-reduce:animate-none ${SIZE_CLASSES[size]}`}
      >
        <button
          type="button"
          aria-label="Cerrar ventana"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
        {icon && <div className="mb-4 flex justify-center">{icon}</div>}
        <h2 className="mb-6 text-center text-xl font-bold text-ink">{title}</h2>
        {children}
      </dialog>
    </div>
  );
};
