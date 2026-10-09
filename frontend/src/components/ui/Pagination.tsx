import { Button } from './Button';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export const Pagination = ({ page, limit, total, onPageChange, disabled = false }: PaginationProps) => {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 pt-4 text-sm">
      <span className="text-ink-soft">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className="px-2 text-ink-soft">
          Página {page} de {lastPage}
        </span>
        <Button
          variant="secondary"
          disabled={disabled || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
};
