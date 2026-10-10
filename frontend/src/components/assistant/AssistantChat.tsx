import type { ChatResponse } from '@/@types/api';
import { useChatMutation } from '@/api/ai.api';
import { isServiceUnavailable } from '@/utils/problem-details';
import { type ChatValues, chatSchema } from '@/validators/chat';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import { AssistantMessage } from './AssistantMessage';

type ChatEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; response: ChatResponse };

const SUGGESTIONS = [
  '¿Cuál es la política de contraseñas?',
  '¿Cuántos inicios de sesión fallidos hubo hoy?',
  '¿Qué permisos tiene el rol MANAGER?',
];

const TypingIndicator = () => (
  <output
    aria-label="El asistente está respondiendo"
    className="flex w-fit gap-1.5 rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3.5 shadow-sm"
  >
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        className="h-2 w-2 animate-bounce rounded-full bg-primary motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </output>
);

export const AssistantChat = ({ onClose }: { onClose: () => void }) => {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [chat, { isLoading, error, reset: resetRequest }] = useChatMutation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<ChatValues>({ resolver: zodResolver(chatSchema) });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll down whenever a message arrives or loading toggles
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, isLoading]);

  const send = async (message: string) => {
    setEntries((current) => [...current, { id: current.length, role: 'user', text: message }]);
    const result = await chat({ message, conversationId });
    if ('error' in result) return;
    setConversationId(result.data.conversationId ?? conversationId);
    setEntries((current) => [...current, { id: current.length, role: 'assistant', response: result.data }]);
  };

  const onSubmit = ({ message }: ChatValues) => {
    resetForm();
    return send(message);
  };

  const startNewConversation = () => {
    setEntries([]);
    setConversationId(undefined);
    resetRequest();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-card px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="assistant" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-ink">Asistente Toka</h2>
          <p className="truncate text-xs text-ink-soft">Usuarios, roles, auditoría y políticas</p>
        </div>
        <button
          type="button"
          title="Nueva conversación"
          aria-label="Nueva conversación"
          onClick={startNewConversation}
          className="rounded-md p-2 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary"
        >
          <Icon name="refresh" className="h-[1.15rem] w-[1.15rem]" />
        </button>
        <button
          type="button"
          title="Cerrar asistente"
          aria-label="Cerrar asistente"
          onClick={onClose}
          className="rounded-md p-2 text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary"
        >
          <Icon name="x" className="h-[1.15rem] w-[1.15rem]" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-page p-5" aria-live="polite">
        {entries.length === 0 && !isLoading && (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl rounded-bl-md border border-line bg-card p-4 text-sm text-ink shadow-sm">
              Hola, soy el asistente de Toka. Puedo consultar usuarios, roles y auditoría, y resolver dudas
              sobre las políticas de la plataforma.
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Prueba preguntando
              </p>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="block w-full rounded-xl border border-line bg-card px-4 py-2.5 text-left text-sm text-ink transition-colors hover:border-primary hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {entries.map((entry) =>
          entry.role === 'user' ? (
            <div
              key={entry.id}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white"
            >
              {entry.text}
            </div>
          ) : (
            <div
              key={entry.id}
              className="max-w-[94%] rounded-2xl rounded-bl-md border border-line bg-card p-4 shadow-sm"
            >
              <AssistantMessage response={entry.response} />
            </div>
          ),
        )}

        {isLoading && <TypingIndicator />}
        {isServiceUnavailable(error) && (
          <output className="block rounded-xl border-l-4 border-l-warning bg-warning-soft p-3 text-sm text-ink">
            El asistente no está disponible en este momento. Intenta de nuevo en un minuto.
          </output>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="border-t border-line bg-card p-4">
        <div className="flex items-center gap-2">
          <input
            aria-label="Mensaje"
            placeholder="Escribe tu pregunta…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full border border-line-strong bg-page px-5 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            {...register('message')}
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {isLoading ? <Spinner /> : <Icon name="send" className="h-5 w-5" />}
          </button>
        </div>
        {errors.message && (
          <p role="alert" className="mt-2 pl-4 text-xs text-danger">
            {errors.message.message}
          </p>
        )}
      </form>
    </div>
  );
};
