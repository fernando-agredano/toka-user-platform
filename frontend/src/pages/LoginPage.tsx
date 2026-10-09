import { useLoginMutation } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { type LoginValues, loginSchema } from '@/validators/account';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

export const LoginPage = () => {
  const [login, { isLoading }] = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // On success the session starts in the store and GuestOnly redirects into the app.
  const onSubmit = (values: LoginValues) => login(values);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-bold text-ink">Iniciar sesión</h1>
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" loading={isLoading} className="w-full">
        Entrar
      </Button>
      <p className="text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
};
