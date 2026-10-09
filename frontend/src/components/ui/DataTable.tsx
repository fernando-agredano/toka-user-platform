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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-3 font-medium ${column.className ?? ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <tr key={index} className="border-b border-line last:border-0">
                  {columns.map((column) => (
                    <td key={column.header} className="px-4 py-4">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr key={rowKey(row)} className="border-b border-line last:border-0">
                  {columns.map((column) => (
                    <td key={column.header} className={`px-4 py-3 align-middle ${column.className ?? ''}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!isLoading && rows?.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-soft">{emptyMessage}</p>
      )}
    </div>
  );
};
