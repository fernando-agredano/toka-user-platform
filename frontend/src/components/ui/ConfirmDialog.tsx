import { Button } from './Button';
import { Icon } from './Icon';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the dialog and the confirm button as a risky action. */
  destructive?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    title={title}
    size="sm"
    onClose={onCancel}
    icon={
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          destructive ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'
        }`}
      >
        <Icon name={destructive ? 'alert' : 'info'} className="h-7 w-7" />
      </span>
    }
  >
    <p className="-mt-3 text-center text-sm text-ink-soft">{message}</p>
    <div className="mt-8 grid grid-cols-2 gap-3">
      <Button variant="secondary" size="lg" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant={destructive ? 'danger' : 'primary'} size="lg" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);
