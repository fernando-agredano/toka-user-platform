import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { Tooltip } from '@/components/ui/Tooltip';
import { usePermissions } from '@/hooks/use-permissions';
import { NAV_ITEMS } from '@/routes/navigation';
import { NavLink } from 'react-router-dom';
import { UserMenu } from './UserMenu';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarLink {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const HOME_LINK: SidebarLink = { to: '/', label: 'Inicio', icon: 'home', end: true };

// Every control is anchored to the left with the same padding in both states, so the icons sit at
// the same x position expanded or collapsed (nav px-3 + link px-3 + 24px icon centers it in 72px).
const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3.5 text-base font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    isActive ? 'text-primary' : 'text-ink-soft hover:text-primary'
  }`;

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { can } = usePermissions();
  const links: SidebarLink[] = [HOME_LINK, ...NAV_ITEMS.filter((item) => can(item.permission))];
  const toggleLabel = collapsed ? 'Abrir barra lateral' : 'Contraer barra lateral';

  return (
    <aside
      className={`shrink-0 border-b border-line bg-card md:flex md:h-full md:flex-col md:border-b-0 md:border-r md:transition-[width] md:duration-200 ${
        collapsed ? 'md:w-[4.5rem]' : 'md:w-60'
      }`}
    >
      <div className="flex h-[4.5rem] items-center justify-between border-b border-line px-4">
        <NavLink to="/" aria-label="Toka, inicio" className={collapsed ? 'md:hidden' : ''}>
          <Logo />
        </NavLink>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="hidden h-10 w-10 items-center justify-center rounded-md text-ink-soft transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex"
        >
          <Icon name="panel" className="h-5 w-5" />
        </button>
      </div>

      <nav
        aria-label="Principal"
        className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0"
      >
        {links.map((link) => (
          <Tooltip key={link.to} label={link.label} disabled={!collapsed}>
            <NavLink to={link.to} end={link.end} className={navLinkClasses}>
              <Icon name={link.icon} className="h-6 w-6 shrink-0" />
              <span className={`transition-opacity ${collapsed ? 'md:opacity-0' : ''}`}>{link.label}</span>
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
};
