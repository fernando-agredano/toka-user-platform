import type { ReactNode } from 'react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyMessage: string;
  skeletonRows?: number;
  /** Classes for the scroll container, e.g. `min-h-0 flex-1` to fill a bounded card. */
  className?: string;
}

export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
  skeletonRows = 5,
  className = '',
}: DataTableProps<T>) => {
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-ink-soft">No se pudieron cargar los datos.</p>
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-ink-muted">
            {columns.map((column) => (
              <th
                key={column.header}
                className={`sticky top-0 z-10 bg-page px-4 py-3.5 font-semibold ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.header} className="px-4 py-4">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.header} className={`px-4 py-4 align-middle ${column.className ?? ''}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!isLoading && rows?.length === 0 && (
        <p className="py-14 text-center text-sm text-ink-soft">{emptyMessage}</p>
      )}
    </div>
  );
};
