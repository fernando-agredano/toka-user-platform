import { fieldValidity } from '@/hooks/use-field-validity';
import type { NewAccountValues } from '@/validators/account';
import type { UseFormReturn } from 'react-hook-form';
import { TextField } from '../ui/Field';

/** Shared by self-registration and the admin "create user" modal: both send the same payload. */
export const NewAccountFields = ({ form }: { form: UseFormReturn<NewAccountValues> }) => {
  const { register, formState } = form;
  const { errors } = formState;
  const isValid = fieldValidity(formState);

  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField
          label="Nombre"
          autoComplete="given-name"
          error={errors.firstName?.message}
          valid={isValid('firstName')}
          {...register('firstName')}
        />
        <TextField
          label="Apellido"
          autoComplete="family-name"
          error={errors.lastName?.message}
          valid={isValid('lastName')}
          {...register('lastName')}
        />
      </div>
      <TextField
        label="Correo"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        valid={isValid('email')}
        {...register('email')}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo."
        error={errors.password?.message}
        valid={isValid('password')}
        {...register('password')}
      />
    </>
  );
};
