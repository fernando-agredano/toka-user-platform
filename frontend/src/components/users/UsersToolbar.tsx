import type { UserStatus } from '@/@types/api';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/SearchInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select } from '../ui/Select';

export type StatusFilter = UserStatus | '';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface UsersToolbarProps {
  search: string;
  status: StatusFilter;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onPageSizeChange: (value: number) => void;
  onClear: () => void;
}

export const UsersToolbar = ({
  search,
  status,
  pageSize,
  onSearchChange,
  onStatusChange,
  onPageSizeChange,
  onClear,
}: UsersToolbarProps) => {
  const hasActiveFilters = search !== '' || status !== '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        label="Buscar usuarios"
        placeholder="Buscar por nombre o correo"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="w-full sm:w-80"
      />
      <SegmentedControl label="Estado" options={STATUS_OPTIONS} value={status} onChange={onStatusChange} />
      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
      <Select
        compact
        className="ml-auto w-36"
        value={String(pageSize)}
        onChange={(value) => onPageSizeChange(Number(value))}
        options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size} por página` }))}
      />
    </div>
  );
};
