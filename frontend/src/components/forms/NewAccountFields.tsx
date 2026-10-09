import type { NewAccountValues } from '@/validators/account';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { TextField } from '../ui/Field';

interface NewAccountFieldsProps {
  register: UseFormRegister<NewAccountValues>;
  errors: FieldErrors<NewAccountValues>;
}

/** Shared by self-registration and the admin "create user" modal: both send the same payload. */
export const NewAccountFields = ({ register, errors }: NewAccountFieldsProps) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Nombre"
        autoComplete="given-name"
        error={errors.firstName?.message}
        {...register('firstName')}
      />
      <TextField
        label="Apellido"
        autoComplete="family-name"
        error={errors.lastName?.message}
        {...register('lastName')}
      />
    </div>
    <TextField
      label="Correo"
      type="email"
      autoComplete="email"
      error={errors.email?.message}
      {...register('email')}
    />
    <TextField
      label="Contraseña"
      type="password"
      autoComplete="new-password"
      hint="Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo."
      error={errors.password?.message}
      {...register('password')}
    />
  </>
);
