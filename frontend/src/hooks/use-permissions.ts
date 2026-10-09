import { selectCurrentUser } from '@/api/auth-slice';
import { useCallback } from 'react';
import { useAppSelector } from './redux';

export const usePermissions = () => {
  const user = useAppSelector(selectCurrentUser);
  const can = useCallback((permission: string) => user?.permissions.includes(permission) ?? false, [user]);
  return { can, user };
};
