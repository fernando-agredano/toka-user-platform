import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;

interface FloatingPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  /** The panel receives this ref so outside-click logic can treat it as part of the component. */
  panelRef: RefObject<HTMLDivElement>;
  /** Make the panel as wide as the anchor (dropdowns) instead of its own width (calendars). */
  matchAnchorWidth?: boolean;
  children: ReactNode;
}

interface Position {
  top: number;
  left: number;
  width?: number;
}

/**
 * Renders children in a portal over the page, positioned from the anchor's screen coordinates, so no
 * `overflow` ancestor can clip it. It opens below the anchor, flips above when there is no room, and
 * is clamped horizontally inside the window.
 */
export const FloatingPanel = ({
  anchorRef,
  panelRef,
  matchAnchorWidth = false,
  children,
}: FloatingPanelProps) => {
  const [position, setPosition] = useState<Position | null>(null);
  const measure = useRef<() => void>(() => undefined);

  measure.current = () => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!anchor || !panel) return;
    const fitsBelow = anchor.bottom + ANCHOR_GAP + panel.height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsBelow
      ? anchor.bottom + ANCHOR_GAP
      : Math.max(VIEWPORT_MARGIN, anchor.top - ANCHOR_GAP - panel.height);
    const width = matchAnchorWidth ? anchor.width : panel.width;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.left),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    setPosition({ top, left, width: matchAnchorWidth ? anchor.width : undefined });
  };

  // Measure before paint so the panel never flashes at the wrong place, and follow the anchor afterwards.
  useLayoutEffect(() => {
    measure.current();
    const update = () => measure.current();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="z-[65]"
    >
      {children}
    </div>,
    document.body,
  );
};
