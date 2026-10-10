import { DatePicker } from '@/components/ui/DatePicker';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('DatePicker', () => {
  it('abre el calendario en el mes del valor y devuelve el día elegido como yyyy-mm-dd', async () => {
    const onChange = jest.fn();
    render(<DatePicker label="Desde" value="2026-03-10" onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Desde/ }));
    expect(screen.getByText('Marzo de 2026')).toBeInTheDocument();

    await user.click(screen.getByText('15'));

    expect(onChange).toHaveBeenCalledWith('2026-03-15');
  });

  it('cambia de mes y permite limpiar la fecha elegida', async () => {
    const onChange = jest.fn();
    render(<DatePicker label="Hasta" value="2026-03-10" onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Hasta/ }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('Abril de 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
