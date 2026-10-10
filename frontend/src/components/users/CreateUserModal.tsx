import { useCreateUserMutation } from '@/api/users.api';
import { useToast } from '@/hooks/use-toast';
import { type NewAccountValues, newAccountSchema } from '@/validators/account';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { NewAccountFields } from '../forms/NewAccountFields';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export const CreateUserModal = ({ onClose }: { onClose: () => void }) => {
  const toast = useToast();
  const [createUser, { isLoading }] = useCreateUserMutation();
  const form = useForm<NewAccountValues>({ resolver: zodResolver(newAccountSchema), mode: 'onTouched' });

  const onSubmit = async (values: NewAccountValues) => {
    const result = await createUser(values);
    if ('error' in result) return;
    toast.success(`${result.data.email} ya puede iniciar sesión.`, 'Usuario creado');
    onClose();
  };

  return (
    <Modal title="Nuevo usuario" size="lg" onClose={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-1">
        <NewAccountFields form={form} />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" loading={isLoading}>
            Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
};
