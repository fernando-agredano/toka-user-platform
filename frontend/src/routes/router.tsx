import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AppLayout } from '@/templates/AppLayout';
import { AuthLayout } from '@/templates/AuthLayout';
import { createBrowserRouter } from 'react-router-dom';
import { GuestOnly, RequireAuth, RequirePermission } from './guards';
import { NAV_ITEMS } from './navigation';

const permissionGuardedPages = NAV_ITEMS.map(({ to, permission, page }) => ({
  path: to,
  element: <RequirePermission permission={permission}>{page}</RequirePermission>,
}));

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          ...permissionGuardedPages,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
