import {
  type AppNotification,
  allNotificationsRead,
  notificationRead,
  notificationsCleared,
  selectNotifications,
} from '@/api/notification-slice';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useDismissable } from '@/hooks/use-dismissable';
import { formatRelativeTime } from '@/utils/format';
import { useCallback, useRef, useState } from 'react';

const KIND_STYLES: Record<AppNotification['kind'], { icon: IconName; badge: string }> = {
  success: { icon: 'check', badge: 'bg-success-soft text-success' },
  error: { icon: 'alert', badge: 'bg-danger-soft text-danger' },
  info: { icon: 'info', badge: 'bg-info-soft text-info' },
  warning: { icon: 'alert', badge: 'bg-warning-soft text-warning' },
};

const PANEL_ACTION =
  'whitespace-nowrap text-xs font-semibold text-primary transition-colors hover:underline disabled:text-ink-muted disabled:no-underline';

export const NotificationBell = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((notification) => !notification.read).length;

  const close = useCallback(() => setOpen(false), []);
  useDismissable([rootRef], open, close);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="bell" className="h-[1.35rem] w-[1.35rem]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full border-2 border-card bg-danger px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <dialog
          open
          aria-label="Notificaciones"
          className="absolute left-auto right-0 top-full z-40 m-0 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-xl border border-line bg-card p-0 text-ink shadow-xl motion-reduce:animate-none"
        >
          <div className="flex items-center gap-2.5 px-5 py-4">
            <h2 className="whitespace-nowrap text-base font-bold text-ink">Notificaciones</h2>
            {unread > 0 && (
              <span className="whitespace-nowrap rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                {unread} {unread === 1 ? 'nueva' : 'nuevas'}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center justify-between border-y border-line bg-page px-5 py-2">
              <button
                type="button"
                className={PANEL_ACTION}
                disabled={unread === 0}
                onClick={() => dispatch(allNotificationsRead())}
              >
                Marcar como leídas
              </button>
              <button type="button" className={PANEL_ACTION} onClick={() => dispatch(notificationsCleared())}>
                Limpiar todo
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Icon name="bell" className="h-8 w-8 text-ink-muted" />
              <p className="text-sm font-medium text-ink">Estás al día</p>
              <p className="text-xs text-ink-soft">
                Aquí verás los avisos de lo que ocurre en la plataforma.
              </p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
              {notifications.map((notification) => {
                const style = KIND_STYLES[notification.kind];
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => dispatch(notificationRead(notification.id))}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-page ${
                        notification.read ? '' : 'bg-primary-soft/40'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.badge}`}
                      >
                        <Icon name={style.icon} className="h-[1.1rem] w-[1.1rem]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">{notification.title}</span>
                          {!notification.read && (
                            <span
                              aria-label="Sin leer"
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-soft">{notification.message}</span>
                        <span className="mt-1 block text-xs text-ink-muted">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </dialog>
      )}
    </div>
  );
};
