import type { UserView } from '@/@types/api';
import { useListUsersQuery } from '@/api/users.api';
import { useDebounce } from '@/hooks/use-debounce';
import { fullName } from '@/utils/format';
import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { SearchInput } from '../ui/SearchInput';
import { SkeletonList } from '../ui/Skeleton';

const MAX_RESULTS = 25;

interface UserPickerProps {
  selectedId?: string;
  onSelect: (user: UserView) => void;
}

/** Searchable user list: the search box stays put while the results scroll. */
export const UserPicker = ({ selectedId, onSelect }: UserPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const { data, isLoading, isError } = useListUsersQuery({
    page: 1,
    limit: MAX_RESULTS,
    search: search || undefined,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line p-4">
        <SearchInput
          label="Buscar usuario"
          placeholder="Buscar por nombre o correo"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading && <SkeletonList count={5} itemClassName="h-12 w-full" />}
        {isError && <p className="p-3 text-sm text-danger">No se pudo cargar la lista de usuarios.</p>}
        {data?.items.length === 0 && <p className="p-3 text-sm text-ink-soft">Sin resultados.</p>}
        <ul className="space-y-0.5">
          {data?.items.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => onSelect(user)}
                aria-pressed={user.id === selectedId}
                className={`flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  user.id === selectedId ? 'bg-primary-soft' : 'hover:bg-page'
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
    </div>
  );
};
