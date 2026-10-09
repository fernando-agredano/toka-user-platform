import { useRegisterMutation } from '@/api/auth.api';
import { NewAccountFields } from '@/components/forms/NewAccountFields';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/use-toast';
import { type NewAccountValues, newAccountSchema } from '@/validators/account';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [registerAccount, { isLoading }] = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewAccountValues>({ resolver: zodResolver(newAccountSchema) });

  const onSubmit = async (values: NewAccountValues) => {
    const result = await registerAccount(values);
    if ('error' in result) return;
    toast.success('Cuenta creada. Ya puedes iniciar sesión.');
    navigate('/login');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <h1 className="text-xl font-bold text-ink">Crear cuenta</h1>
      <NewAccountFields register={register} errors={errors} />
      <Button type="submit" loading={isLoading} className="w-full">
        Registrarme
      </Button>
      <p className="text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
};
