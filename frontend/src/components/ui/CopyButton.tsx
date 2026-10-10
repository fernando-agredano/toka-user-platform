import { useToast } from '@/hooks/use-toast';

interface CopyButtonProps {
  text: string;
  /** What is being copied, for the confirmation toast ("Comando", "ID del evento"...). */
  what: string;
}

export const CopyButton = ({ text, what }: CopyButtonProps) => {
  const toast = useToast();
  const copy = async () => {
    await navigator.clipboard?.writeText(text);
    toast.info(`${what} copiado al portapapeles.`, 'Copiado');
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 text-xs font-semibold text-primary hover:underline"
    >
      Copiar
    </button>
  );
};
