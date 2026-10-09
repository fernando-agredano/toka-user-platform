import { toastPushed } from '@/api/toast-slice';
import { useMemo } from 'react';
import { useAppDispatch } from './redux';

/** Success feedback; errors are toasted automatically by the store's error listener. */
export const useToast = () => {
  const dispatch = useAppDispatch();
  return useMemo(
    () => ({ success: (message: string) => dispatch(toastPushed('success', message)) }),
    [dispatch],
  );
};
