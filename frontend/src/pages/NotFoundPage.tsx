import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <Card className="mx-auto mt-12 max-w-md text-center">
    <h1 className="text-xl font-bold text-ink">Página no encontrada</h1>
    <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
      Volver al inicio
    </Link>
  </Card>
);
