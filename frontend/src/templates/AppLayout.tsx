import { useLogoutMutation } from '@/api/auth.api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { NAV_ITEMS } from '@/routes/navigation';
import { NavLink, Outlet } from 'react-router-dom';

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-primary-soft hover:text-primary'
  }`;

export const AppLayout = () => {
  const { can, user } = usePermissions();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { theme, toggleTheme } = useTheme();
  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-card md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <NavLink to="/" className="text-2xl font-bold text-primary">
            Toka
          </NavLink>
        </div>
        <nav
          aria-label="Principal"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:pb-0"
        >
          <p className="hidden px-3 pb-1 text-xs uppercase tracking-wide text-ink-muted md:block">General</p>
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClasses}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-line bg-card px-6 py-3">
          <div className="mr-auto flex items-center gap-3">
            <Avatar name={user?.email ?? ''} />
            <div className="text-sm">
              <p className="font-medium text-ink">{user?.email}</p>
              <div className="mt-0.5 flex gap-1">
                {user?.roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </Button>
          <Button variant="secondary" loading={isLoggingOut} onClick={() => logout()}>
            Cerrar sesión
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
