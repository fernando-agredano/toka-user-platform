import { Icon } from './Icon';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const NAV_BUTTON =
  'flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink';

export const Pagination = ({ page, limit, total, onPageChange, disabled = false }: PaginationProps) => {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm">
      <span className="text-ink-soft">
        <span className="font-semibold text-ink">
          {from}–{to}
        </span>{' '}
        de {total}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={NAV_BUTTON}
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-ink-soft">
          Página {page} de {lastPage}
        </span>
        <button
          type="button"
          className={NAV_BUTTON}
          disabled={disabled || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
