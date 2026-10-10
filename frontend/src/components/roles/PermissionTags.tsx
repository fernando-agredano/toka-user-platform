import { groupPermissions } from '@/utils/permissions';
import { Icon } from '../ui/Icon';

interface PermissionTagsProps {
  permissions: string[];
  /** Smaller pills with short action names, for dense places such as the role cards. */
  compact?: boolean;
}

/** One pill per resource: its icon and name, with the allowed actions nested inside. */
export const PermissionTags = ({ permissions, compact = false }: PermissionTagsProps) => {
  const groups = groupPermissions(permissions, compact);
  if (groups.length === 0) return <p className="text-sm text-ink-soft">Sin permisos.</p>;

  return (
    <ul className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {groups.map((group) => (
        <li
          key={group.resource}
          className={`inline-flex items-center rounded-full border border-line bg-card ${
            compact ? 'gap-1.5 py-0.5 pl-2 pr-0.5' : 'gap-2 py-1 pl-2.5 pr-1'
          }`}
        >
          <Icon name={group.icon} className={compact ? 'h-3.5 w-3.5 text-primary' : 'h-4 w-4 text-primary'} />
          <span className={`font-semibold text-ink ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {group.label}
          </span>
          <span className="flex gap-1">
            {group.actions.map((action) => (
              <span
                key={action}
                className={`rounded-full bg-primary-soft font-semibold text-primary ${
                  compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
                }`}
              >
                {action}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
};
