import { UsersPage } from '@/pages/UsersPage';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem, makeSession, makeUser } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const USERS_URL = '/api/users';
const SKELETON_ROW_COUNT = 5;

const page = (items: ReturnType<typeof makeUser>[]) => ({ items, page: 1, limit: 10, total: items.length });

const renderUsersPage = (permissions: string[] = ['users:read']) =>
  renderWithProviders(<UsersPage />, { path: '/users', session: makeSession(permissions) });

const tableBodyRows = (container: HTMLElement) => container.querySelectorAll('tbody tr');

describe('UsersPage', () => {
  it('muestra filas de esqueleto mientras carga la lista', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.json(page([makeUser()]))));
    const { container } = renderUsersPage();

    expect(tableBodyRows(container)).toHaveLength(SKELETON_ROW_COUNT);
    expect(screen.queryByText('Luis Pérez')).not.toBeInTheDocument();

    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(tableBodyRows(container)).toHaveLength(1);
  });

  it('muestra los usuarios con su correo y estado', async () => {
    server.use(
      http.get(USERS_URL, () =>
        HttpResponse.json(
          page([
            makeUser({ id: 'u1', firstName: 'Luis', lastName: 'Pérez', email: 'luis@toka.local' }),
            makeUser({
              id: 'u2',
              firstName: 'Marta',
              lastName: 'Ruiz',
              email: 'marta@toka.local',
              status: 'INACTIVE',
            }),
          ]),
        ),
      ),
    );
    renderUsersPage();

    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(screen.getByText('luis@toka.local')).toBeInTheDocument();
    expect(screen.getByText('Marta Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('muestra el mensaje de error con reintento y recupera los datos al reintentar', async () => {
    let attempts = 0;
    server.use(
      http.get(USERS_URL, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(makeProblem(500, 'Fallo interno'), {
            status: 500,
            headers: { 'Content-Type': 'application/problem+json' },
          });
        }
        return HttpResponse.json(page([makeUser({ firstName: 'Luis', lastName: 'Pérez' })]));
      }),
    );
    renderUsersPage();

    expect(await screen.findByText('No se pudieron cargar los datos.')).toBeInTheDocument();
    expect(screen.queryByText('Luis Pérez')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('indica que no hay resultados cuando la lista llega vacía', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.json(page([]))));
    renderUsersPage();

    expect(await screen.findByText('No hay usuarios que coincidan con la búsqueda.')).toBeInTheDocument();
  });

  it('solo ofrece crear y editar cuando el usuario tiene users:write', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.json(page([makeUser()]))));
    renderUsersPage(['users:read']);

    await screen.findByText('Luis Pérez');
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('muestra las acciones de escritura cuando el usuario tiene users:write', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.json(page([makeUser()]))));
    renderUsersPage(['users:read', 'users:write']);

    await screen.findByText('Luis Pérez');
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });
});
