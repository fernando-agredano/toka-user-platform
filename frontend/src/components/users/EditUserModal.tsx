import type { UserView } from '@/@types/api';
import { useUpdateUserMutation } from '@/api/users.api';
import { useToast } from '@/hooks/use-toast';
import { type EditUserValues, editUserSchema } from '@/validators/account';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface EditUserModalProps {
  user: UserView;
  onClose: () => void;
}

export const EditUserModal = ({ user, onClose }: EditUserModalProps) => {
  const toast = useToast();
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const onSubmit = async (values: EditUserValues) => {
    const result = await updateUser({ id: user.id, ...values });
    if ('error' in result) return;
    toast.success('Los cambios se guardaron correctamente.', 'Usuario actualizado');
    onClose();
  };

  return (
    <Modal title="Editar usuario" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-1">
        <p className="pb-4 text-center text-sm text-ink-soft">{user.email}</p>
        <TextField label="Nombre" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Apellido" error={errors.lastName?.message} {...register('lastName')} />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" loading={isLoading}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
};
