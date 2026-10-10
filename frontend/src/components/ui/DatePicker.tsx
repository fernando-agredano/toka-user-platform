import { useDismissable } from '@/hooks/use-dismissable';
import { useCallback, useId, useRef, useState } from 'react';
import { FloatingPanel } from './FloatingPanel';
import { Icon } from './Icon';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const monthFormat = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const displayFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

const pad = (number: number) => String(number).padStart(2, '0');
const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key: string) => {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface DatePickerProps {
  label: string;
  /** `yyyy-mm-dd`, or an empty string when no date is chosen. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Themed calendar popover; the value format matches `<input type="date">` so filters need no conversion. */
export const DatePicker = ({
  label,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
}: DatePickerProps) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (value ? fromKey(value) : new Date()));

  const close = useCallback(() => setOpen(false), []);
  useDismissable([rootRef, panelRef], open, close);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const shiftMonth = (delta: number) => setViewMonth(new Date(year, month + delta, 1));
  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };
  const toggle = () => {
    if (!open) setViewMonth(value ? fromKey(value) : new Date());
    setOpen((current) => !current);
  };

  return (
    <div ref={rootRef} className="relative">
      <span id={`${id}-label`} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        id={`${id}-button`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-button`}
        onClick={toggle}
        className={`flex w-full items-center gap-3 rounded-sm border bg-card px-4 py-3 text-left text-base transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
          open ? 'border-primary' : 'border-line-strong'
        }`}
      >
        <Icon name="calendar" className="h-5 w-5 shrink-0 text-ink-muted" />
        <span className={`truncate ${value ? 'text-ink' : 'text-ink-muted'}`}>
          {value ? displayFormat.format(fromKey(value)) : placeholder}
        </span>
      </button>

      {open && (
        <FloatingPanel anchorRef={buttonRef} panelRef={panelRef}>
          <dialog
            open
            aria-label={`Calendario de ${label}`}
            className="static m-0 w-72 animate-pop-in rounded-lg border border-line bg-card p-4 text-ink shadow-lg motion-reduce:animate-none"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => shiftMonth(-1)}
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <Icon name="chevronLeft" className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-ink">{capitalize(monthFormat.format(viewMonth))}</p>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => shiftMonth(1)}
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="pb-1 text-xs font-medium text-ink-muted">
                  {weekday}
                </span>
              ))}
              {Array.from({ length: leadingBlanks }, (_, offset) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static blank cells before day 1
                <span key={`blank-${offset}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, offset) => {
                const key = toKey(new Date(year, month, offset + 1));
                const isSelected = key === value;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={displayFormat.format(fromKey(key))}
                    aria-pressed={isSelected}
                    onClick={() => pick(key)}
                    className={`mx-auto h-9 w-9 rounded-full text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary font-semibold text-white'
                        : key === todayKey
                          ? 'border border-primary font-semibold text-primary hover:bg-primary-soft'
                          : 'text-ink hover:bg-primary-soft'
                    }`}
                  >
                    {offset + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-semibold">
              <button type="button" onClick={() => pick(todayKey)} className="text-primary hover:underline">
                Hoy
              </button>
              <button
                type="button"
                disabled={!value}
                onClick={() => pick('')}
                className="text-ink-soft hover:text-ink disabled:opacity-40"
              >
                Limpiar
              </button>
            </div>
          </dialog>
        </FloatingPanel>
      )}
    </div>
  );
};
