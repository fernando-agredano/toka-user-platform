import { Toaster } from '@/components/ui/Toaster';
import { router } from '@/routes/router';
import { RouterProvider } from 'react-router-dom';

export const App = () => (
  <>
    <RouterProvider router={router} />
    <Toaster />
  </>
);
