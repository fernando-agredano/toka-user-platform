import { RegisterPage } from '@/pages/RegisterPage';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const REGISTER_URL = '/api/auth/register';

const VALID_ACCOUNT = {
  firstName: 'Ana',
  lastName: 'García',
  email: 'ana@toka.local',
  password: 'Segura123!',
};

const fillForm = async (values: Partial<typeof VALID_ACCOUNT>) => {
  const user = userEvent.setup();
  const entries = { ...VALID_ACCOUNT, ...values };
  await user.type(screen.getByLabelText('Nombre'), entries.firstName);
  await user.type(screen.getByLabelText('Apellido'), entries.lastName);
  await user.type(screen.getByLabelText('Correo'), entries.email);
  await user.type(screen.getByLabelText('Contraseña'), entries.password);
  await user.click(screen.getByRole('button', { name: 'Registrarme' }));
};

const renderRegister = () =>
  renderWithProviders(<RegisterPage />, {
    path: '/register',
    routes: [
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <h1>Pantalla de login</h1> },
    ],
  });

describe('RegisterPage', () => {
  it('exige todos los campos y no envía la petición', async () => {
    let requests = 0;
    server.use(
      http.post(REGISTER_URL, () => {
        requests += 1;
        return HttpResponse.json({ userId: 'new-id' }, { status: 201 });
      }),
    );
    renderRegister();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El apellido es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El correo es obligatorio')).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('explica el primer requisito de contraseña que no se cumple', async () => {
    renderRegister();

    await fillForm({ password: 'segura' });

    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('rechaza una contraseña sin mayúscula aunque tenga longitud suficiente', async () => {
    renderRegister();

    await fillForm({ password: 'segura123!' });

    expect(await screen.findByText('Debe incluir una mayúscula')).toBeInTheDocument();
  });

  it('crea la cuenta, avisa y navega a login', async () => {
    let sentBody: unknown;
    server.use(
      http.post(REGISTER_URL, async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ userId: 'new-id' }, { status: 201 });
      }),
    );
    const { router } = renderRegister();

    await fillForm({});

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(sentBody).toEqual(VALID_ACCOUNT);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByText('Cuenta creada. Ya puedes iniciar sesión.')).toBeInTheDocument();
  });

  it('se queda en el formulario y muestra el error del servidor cuando el correo ya existe', async () => {
    server.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json(makeProblem(409, 'El correo ya está registrado'), {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );
    const { router } = renderRegister();

    await fillForm({});

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo ya está registrado');
    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
    expect(screen.getByRole('button', { name: 'Registrarme' })).toBeEnabled();
  });
});
