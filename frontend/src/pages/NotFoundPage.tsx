import { Page } from '@/components/layout/Page';
import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <Page title="Página no encontrada">
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-line bg-card p-8 text-center">
      <p className="text-sm text-ink-soft">La dirección que buscas no existe o ya no está disponible.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
        Volver al inicio
      </Link>
    </div>
  </Page>
);
