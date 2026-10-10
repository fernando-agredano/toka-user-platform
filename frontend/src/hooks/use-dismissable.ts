import { type RefObject, useEffect } from 'react';

/** Calls `onDismiss` on a click outside every ref in `refs` or on Escape, while `active` is true. */
export const useDismissable = (
  refs: RefObject<HTMLElement | null>[],
  active: boolean,
  onDismiss: () => void,
) => {
  useEffect(() => {
    if (!active) return;
    const dismissOnOutsideClick = (event: PointerEvent) => {
      const { target } = event;
      if (target instanceof Node && !refs.some((ref) => ref.current?.contains(target))) onDismiss();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', dismissOnOutsideClick);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsideClick);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [refs, active, onDismiss]);
};
