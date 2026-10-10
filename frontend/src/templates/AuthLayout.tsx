import { Logo } from '@/components/ui/Logo';
import { Outlet } from 'react-router-dom';

export const AuthLayout = () => (
  <main className="flex min-h-screen items-center justify-center bg-page p-4">
    <div className="glass-card w-full max-w-md rounded-lg p-8 shadow-lg">
      <div className="mb-8 flex justify-center">
        <Logo size="lg" />
      </div>
      <Outlet />
    </div>
  </main>
);
