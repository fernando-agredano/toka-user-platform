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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewAccountValues>({ resolver: zodResolver(newAccountSchema) });

  const onSubmit = async (values: NewAccountValues) => {
    const result = await createUser(values);
    if ('error' in result) return;
    toast.success(`Usuario ${result.data.email} creado.`);
    onClose();
  };

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <NewAccountFields register={register} errors={errors} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading}>
            Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
};
