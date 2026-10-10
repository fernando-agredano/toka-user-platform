import { useLoginMutation } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { fieldValidity } from '@/hooks/use-field-validity';
import { type LoginValues, loginSchema } from '@/validators/account';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

export const LoginPage = () => {
  const [login, { isLoading }] = useLoginMutation();
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });
  const { errors } = formState;
  const isValid = fieldValidity(formState);

  // On success the session starts in the store and GuestOnly redirects into the app.
  const onSubmit = (values: LoginValues) => login(values);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-1">
      <h1 className="mb-5 text-center text-2xl font-bold text-ink">Iniciar sesión</h1>
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
        autoComplete="current-password"
        error={errors.password?.message}
        valid={isValid('password')}
        {...register('password')}
      />
      <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
        Entrar
      </Button>
      <p className="pt-4 text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
};
