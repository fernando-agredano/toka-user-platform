import { sessionCleared, sessionStarted } from '@/api/auth-slice';
import { RequirePermission } from '@/routes/guards';
import { act, screen } from '@testing-library/react';
import { makeSession } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const PROTECTED_CONTENT = 'Listado de auditoría';

const renderGuarded = (permissions: string[] | null) => {
  const guarded = (
    <RequirePermission permission="audit:read">
      <p>{PROTECTED_CONTENT}</p>
    </RequirePermission>
  );
  return renderWithProviders(guarded, {
    path: '/audit',
    session: permissions ? makeSession(permissions) : null,
  });
};

describe('RequirePermission', () => {
  it('renderiza la página cuando el usuario tiene el permiso', () => {
    renderGuarded(['audit:read', 'users:read']);

    expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument();
    expect(screen.queryByText('Acceso restringido')).not.toBeInTheDocument();
  });

  it('bloquea la página y nombra el permiso faltante cuando el usuario no lo tiene', () => {
    renderGuarded(['users:read']);

    expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
    expect(screen.getByText('audit:read')).toBeInTheDocument();
  });

  it('bloquea cuando no hay sesión, porque no hay permisos que comprobar', () => {
    renderGuarded(null);

    expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
  });

  it('reacciona al cambiar de permisos sin recargar la página', () => {
    const { store } = renderGuarded(['users:read']);
    expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();

    act(() => {
      store.dispatch(sessionStarted(makeSession(['audit:read'])));
    });

    expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument();
  });

  it('vuelve a bloquear al cerrar sesión', () => {
    const { store } = renderGuarded(['audit:read']);
    expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument();

    act(() => {
      store.dispatch(sessionCleared());
    });

    expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
  });
});
