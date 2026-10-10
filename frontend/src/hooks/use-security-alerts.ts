import { useGetAuditStatsQuery } from '@/api/audit.api';
import { notificationPushed } from '@/api/notification-slice';
import { useEffect, useRef } from 'react';
import { useAppDispatch } from './redux';
import { usePermissions } from './use-permissions';

const POLL_INTERVAL_MS = 30_000;

/** For users who can read the audit log: turns new failed logins and lockouts into notifications. */
export const useSecurityAlerts = () => {
  const dispatch = useAppDispatch();
  const { can } = usePermissions();
  const { data } = useGetAuditStatsQuery({}, { skip: !can('audit:read'), pollingInterval: POLL_INTERVAL_MS });
  const previous = useRef<{ failedLogins: number; lockedAccounts: number } | null>(null);

  useEffect(() => {
    if (!data) return;
    const last = previous.current;
    if (last) {
      const newFailures = data.failedLogins - last.failedLogins;
      const newLockouts = data.lockedAccounts - last.lockedAccounts;
      if (newFailures > 0) {
        dispatch(
          notificationPushed(
            'warning',
            'Inicios de sesión fallidos',
            `${newFailures} ${newFailures === 1 ? 'intento fallido nuevo' : 'intentos fallidos nuevos'} desde la última revisión.`,
          ),
        );
      }
      if (newLockouts > 0) {
        dispatch(
          notificationPushed(
            'error',
            'Cuenta bloqueada',
            `${newLockouts} ${newLockouts === 1 ? 'cuenta se bloqueó' : 'cuentas se bloquearon'} por intentos fallidos.`,
          ),
        );
      }
    }
    previous.current = { failedLogins: data.failedLogins, lockedAccounts: data.lockedAccounts };
  }, [data, dispatch]);
};
