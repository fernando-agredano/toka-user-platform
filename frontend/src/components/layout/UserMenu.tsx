import { useLogoutMutation } from '@/api/auth.api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDismissable } from '@/hooks/use-dismissable';
import { usePermissions } from '@/hooks/use-permissions';
import { displayNameFromEmail } from '@/utils/display-name';
import { useCallback, useRef, useState } from 'react';

// Collapsed, the menu opens beside the sidebar; expanded (and on mobile) it opens above the trigger.
const MENU_PLACEMENT = {
  expanded: 'inset-x-3 bottom-full mb-2',
  collapsed:
    'inset-x-3 bottom-full mb-2 md:inset-x-auto md:bottom-3 md:left-full md:right-auto md:mb-0 md:ml-3 md:w-64',
};

export const UserMenu = ({ collapsed }: { collapsed: boolean }) => {
  const { user } = usePermissions();
  const [logout, { isLoading }] = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const email = user?.email ?? '';
  const hideWhenCollapsed = collapsed ? 'md:opacity-0' : '';

  const close = useCallback(() => setOpen(false), []);
  useDismissable([rootRef], open, close);

  return (
    <div ref={rootRef} className="relative border-t border-line px-3 py-3">
      <Tooltip label={email} disabled={!collapsed || open}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Menú de ${email}`}
          onClick={() => setOpen((current) => !current)}
          className="group flex w-full items-center gap-3 overflow-hidden rounded-full text-left focus:outline-none"
        >
          <Avatar
            name={email}
            size="lg"
            className="transition-colors group-hover:border-primary group-focus-visible:border-primary"
          />
          <span className={`min-w-0 flex-1 transition-opacity ${hideWhenCollapsed}`}>
            <span className="block truncate text-sm font-semibold text-ink">
              {displayNameFromEmail(email)}
            </span>
            <span className="block truncate text-xs text-ink-soft">{user?.roles.join(' · ')}</span>
          </span>
          <Icon
            name="chevron"
            className={`mr-1 h-5 w-5 shrink-0 text-ink-muted transition-opacity ${hideWhenCollapsed}`}
          />
        </button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 rounded-lg border border-line bg-card shadow-lg ${
            MENU_PLACEMENT[collapsed ? 'collapsed' : 'expanded']
          }`}
        >
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Sesión iniciada</p>
            <p className="mt-1 break-all text-sm font-medium text-ink">{email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user?.roles.map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
            </div>
          </div>
          <div className="border-t border-line p-1">
            <button
              type="button"
              role="menuitem"
              disabled={isLoading}
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-60"
            >
              <Icon name="logout" className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
