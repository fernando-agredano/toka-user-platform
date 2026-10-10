import { Select } from '@/components/ui/Select';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

const OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
];

const ControlledSelect = ({ onChange }: { onChange: (value: string) => void }) => {
  const [value, setValue] = useState('');
  return (
    <Select
      label="Estado"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe('Select', () => {
  it('muestra las opciones al abrirlo y elige una con el ratón', async () => {
    const onChange = jest.fn();
    render(<ControlledSelect onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Estado/ }));
    await user.click(screen.getByRole('option', { name: 'Activos' }));

    expect(onChange).toHaveBeenCalledWith('ACTIVE');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activos/ })).toBeInTheDocument();
  });

  it('se maneja con el teclado: flechas para moverse, Enter para elegir y Escape para cerrar', async () => {
    const onChange = jest.fn();
    render(<ControlledSelect onChange={onChange} />);
    const user = userEvent.setup();

    screen.getByRole('button', { name: /Estado/ }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('ACTIVE');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
