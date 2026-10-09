import { selectAuthStatus } from '@/api/auth-slice';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/use-permissions';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

interface RedirectState {
  from?: string;
}

const SessionLoading = () => (
  <div className="mx-auto max-w-md space-y-3 p-8" aria-busy="true" aria-label="Restaurando sesión">
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const RequireAuth = () => {
  const status = useAppSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'bootstrapping') return <SessionLoading />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname } satisfies RedirectState} />;
  }
  return <Outlet />;
};

export const GuestOnly = () => {
  const status = useAppSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'bootstrapping') return <SessionLoading />;
  if (status === 'authenticated') {
    return <Navigate to={(location.state as RedirectState | null)?.from ?? '/'} replace />;
  }
  return <Outlet />;
};

export const RequirePermission = ({ permission, children }: { permission: string; children: ReactNode }) => {
  const { can } = usePermissions();
  if (can(permission)) return children;

  return (
    <Card className="mx-auto mt-12 max-w-md text-center">
      <h1 className="text-xl font-bold text-ink">Acceso restringido</h1>
      <p className="mt-2 text-sm text-ink-soft">
        No tienes el permiso <code className="font-mono">{permission}</code> necesario para ver esta página.
      </p>
    </Card>
  );
};
