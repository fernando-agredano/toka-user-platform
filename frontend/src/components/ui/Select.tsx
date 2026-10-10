import { useDismissable } from '@/hooks/use-dismissable';
import { type KeyboardEvent, useCallback, useId, useRef, useState } from 'react';
import { FloatingPanel } from './FloatingPanel';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Shorter control for toolbars. */
  compact?: boolean;
  className?: string;
}

/** Light, themed replacement for the native <select>: keyboard navigable and styled with the UI tokens. */
export const Select = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar',
  compact = false,
  className = '',
}: SelectProps) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => setOpen(false), []);
  useDismissable([rootRef, panelRef], open, close);

  const openMenu = () => {
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openMenu();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (open && option) choose(option);
      else openMenu();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={className}>
      {label && (
        <span id={`${id}-label`} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={label ? `${id}-label ${id}-button` : undefined}
        id={`${id}-button`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-sm border bg-card text-left text-ink transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
          open ? 'border-primary' : 'border-line-strong'
        } ${compact ? 'px-3 py-2.5 text-sm' : 'px-4 py-3 text-base'}`}
      >
        <span className={`truncate ${selected ? '' : 'text-ink-muted'}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevronDown"
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <FloatingPanel anchorRef={buttonRef} panelRef={panelRef} matchAnchorWidth>
          <div
            id={`${id}-list`}
            // biome-ignore lint/a11y/useSemanticElements: themed listbox, a native <select> cannot be styled
            role="listbox"
            tabIndex={-1}
            className="max-h-60 w-full animate-pop-in overflow-y-auto rounded-md border border-line bg-card p-1 shadow-lg motion-reduce:animate-none"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  id={`${id}-option-${index}`}
                  // biome-ignore lint/a11y/useSemanticElements: themed option of the custom listbox above
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  onKeyDown={() => undefined}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm ${
                    index === activeIndex ? 'bg-primary-soft text-primary' : 'text-ink'
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Icon name="check" className="h-4 w-4 shrink-0 text-primary" />}
                </div>
              );
            })}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
};
