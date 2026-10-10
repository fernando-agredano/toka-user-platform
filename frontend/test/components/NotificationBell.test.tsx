import { notificationPushed } from '@/api/notification-slice';
import { toastPushed } from '@/api/toast-slice';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSession } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const renderBell = () => renderWithProviders(<NotificationBell />, { session: makeSession() });

describe('NotificationBell', () => {
  it('avisa que no hay nada pendiente cuando no hay notificaciones', async () => {
    renderBell();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText('Estás al día')).toBeInTheDocument();
  });

  it('guarda los toasts como notificaciones sin leer y permite marcarlas como leídas', async () => {
    const { store } = renderBell();
    const user = userEvent.setup();

    act(() => {
      store.dispatch(toastPushed('success', 'ana@toka.local ya puede iniciar sesión.', 'Usuario creado'));
      store.dispatch(
        notificationPushed('warning', 'Inicios de sesión fallidos', '2 intentos fallidos nuevos.'),
      );
    });

    const bell = screen.getByRole('button', { name: 'Notificaciones, 2 sin leer' });
    await user.click(bell);
    const panel = within(screen.getByRole('dialog', { name: 'Notificaciones' }));
    expect(panel.getByText('Usuario creado')).toBeInTheDocument();
    expect(panel.getByText('2 intentos fallidos nuevos.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Marcar como leídas' }));

    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('vacía la lista con Limpiar', async () => {
    const { store } = renderBell();
    const user = userEvent.setup();
    act(() => {
      store.dispatch(notificationPushed('info', 'Aviso', 'Algo pasó.'));
    });

    await user.click(screen.getByRole('button', { name: /Notificaciones/ }));
    await user.click(screen.getByRole('button', { name: 'Limpiar todo' }));

    expect(screen.getByText('Estás al día')).toBeInTheDocument();
  });
});
