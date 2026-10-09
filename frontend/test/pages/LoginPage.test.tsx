import { LoginPage } from '@/pages/LoginPage';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem, makeSession } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const LOGIN_URL = '/api/auth/login';

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
};

describe('LoginPage', () => {
  it('muestra errores de validación sin llamar al servidor', async () => {
    let requests = 0;
    server.use(
      http.post(LOGIN_URL, () => {
        requests += 1;
        return HttpResponse.json(makeSession());
      }),
    );
    renderWithProviders(<LoginPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('El correo es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('rechaza un correo con formato inválido', async () => {
    renderWithProviders(<LoginPage />);

    await fillAndSubmit('no-es-correo', 'cualquiera');

    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('inicia sesión en el store cuando las credenciales son válidas', async () => {
    const session = makeSession(['ai:use']);
    server.use(http.post(LOGIN_URL, () => HttpResponse.json(session)));
    const { store } = renderWithProviders(<LoginPage />);

    await fillAndSubmit('ana@toka.local', 'Admin123!');

    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    expect(store.getState().auth.accessToken).toBe(session.accessToken);
    expect(store.getState().auth.user?.permissions).toEqual(['ai:use']);
  });

  it('muestra el detail del servidor como notificación cuando las credenciales son incorrectas', async () => {
    server.use(
      http.post(LOGIN_URL, () =>
        HttpResponse.json(makeProblem(401, 'Credenciales inválidas'), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );
    const { store } = renderWithProviders(<LoginPage />);

    await fillAndSubmit('ana@toka.local', 'Incorrecta1!');

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(store.getState().auth.status).toBe('anonymous');
  });

  it('muestra un mensaje genérico cuando el servidor falla sin ProblemDetails', async () => {
    server.use(http.post(LOGIN_URL, () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<LoginPage />);

    await fillAndSubmit('ana@toka.local', 'Admin123!');

    expect(await screen.findByRole('alert')).toHaveTextContent('Error inesperado (500).');
  });
});
