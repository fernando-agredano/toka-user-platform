import { Card } from '@/components/ui/Card';
import { Outlet } from 'react-router-dom';

export const AuthLayout = () => (
  <main className="flex min-h-screen items-center justify-center p-4">
    <div className="w-full max-w-md">
      <p className="mb-6 text-center text-3xl font-bold text-primary">Toka</p>
      <Card className="shadow-md">
        <Outlet />
      </Card>
    </div>
  </main>
);
