import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { AssistantChat } from './AssistantChat';

/** Floating action button that opens the chat. The chat stays mounted so the conversation survives closing. */
export const AssistantWidget = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        id="assistant-panel"
        hidden={!open}
        className="fixed bottom-24 right-4 z-40 h-[min(36rem,calc(100dvh-8rem))] w-[calc(100vw-2rem)] max-w-[26rem] animate-pop-in overflow-hidden rounded-2xl border border-line bg-card shadow-xl motion-reduce:animate-none md:right-6"
      >
        <AssistantChat onClose={() => setOpen(false)} />
      </div>
      <button
        type="button"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:right-6"
      >
        <Icon name={open ? 'x' : 'assistant'} className="h-7 w-7" />
      </button>
    </>
  );
};
