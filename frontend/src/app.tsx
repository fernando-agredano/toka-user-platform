import { Toaster } from '@/components/ui/Toaster';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { router } from '@/routes/router';
import { RouterProvider } from 'react-router-dom';

export const App = () => (
  <ConfirmProvider>
    <RouterProvider router={router} />
    <Toaster />
  </ConfirmProvider>
);
