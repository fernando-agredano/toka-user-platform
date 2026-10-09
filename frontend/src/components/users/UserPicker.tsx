import type { UserView } from '@/@types/api';
import { useListUsersQuery } from '@/api/users.api';
import { useDebounce } from '@/hooks/use-debounce';
import { fullName } from '@/utils/format';
import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { TextField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';

const MAX_RESULTS = 6;

interface UserPickerProps {
  selectedId?: string;
  onSelect: (user: UserView) => void;
}

export const UserPicker = ({ selectedId, onSelect }: UserPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const { data, isLoading, isError } = useListUsersQuery({
    page: 1,
    limit: MAX_RESULTS,
    search: search || undefined,
  });

  return (
    <div className="space-y-3">
      <TextField
        label="Buscar usuario"
        placeholder="Nombre o correo"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      {isLoading && <Skeleton className="h-32 w-full" />}
      {isError && <p className="text-sm text-danger">No se pudo cargar la lista de usuarios.</p>}
      {data?.items.length === 0 && <p className="text-sm text-ink-soft">Sin resultados.</p>}
      <ul className="space-y-1">
        {data?.items.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => onSelect(user)}
              aria-pressed={user.id === selectedId}
              className={`flex w-full items-center gap-3 rounded-sm p-2 text-left hover:bg-primary-soft ${
                user.id === selectedId ? 'bg-primary-soft' : ''
              }`}
            >
              <Avatar name={fullName(user)} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{fullName(user)}</span>
                <span className="block truncate text-xs text-ink-soft">{user.email}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
