import { ConfirmDialog, type ConfirmOptions } from '@/components/ui/ConfirmDialog';
import { type ReactNode, createContext, useCallback, useContext, useState } from 'react';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

interface PendingConfirmation {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

const ConfirmContext = createContext<Confirm | null>(null);

/** Renders one shared dialog for the whole app: `if (await confirm({...})) doTheThing()`. */
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise((resolve) => setPending({ options, resolve })),
    [],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog {...pending.options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): Confirm => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
};
