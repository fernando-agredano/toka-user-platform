import type { ChatResponse } from '@/@types/api';
import { useChatMutation } from '@/api/ai.api';
import { AssistantMessage } from '@/components/assistant/AssistantMessage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { isServiceUnavailable } from '@/utils/problem-details';
import { type ChatValues, chatSchema } from '@/validators/chat';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

type ChatEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; response: ChatResponse };

export const AssistantPage = () => {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [chat, { isLoading, error }] = useChatMutation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChatValues>({ resolver: zodResolver(chatSchema) });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll down whenever a message arrives or loading toggles
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, isLoading]);

  const onSubmit = async ({ message }: ChatValues) => {
    setEntries((current) => [...current, { id: current.length, role: 'user', text: message }]);
    reset();
    const result = await chat({ message, conversationId });
    if ('error' in result) return;
    setConversationId(result.data.conversationId ?? conversationId);
    setEntries((current) => [...current, { id: current.length, role: 'assistant', response: result.data }]);
  };

  return (
    <>
      <PageHeader
        title="Asistente IA"
        description="Consulta usuarios, roles, auditoría y políticas en lenguaje natural."
      />

      {isServiceUnavailable(error) && (
        <output className="mb-4 block rounded-md border-l-4 border-l-warning bg-warning-soft p-4 text-sm text-ink">
          El asistente no está disponible en este momento. Intenta de nuevo en un minuto.
        </output>
      )}

      <Card className="flex flex-col gap-4">
        <div className="max-h-[60vh] min-h-48 space-y-4 overflow-y-auto" aria-live="polite">
          {entries.length === 0 && !isLoading && (
            <p className="text-sm text-ink-soft">
              Prueba: «¿Cuál es la política de contraseñas?» o «¿Cuántos inicios de sesión fallidos hubo hoy?»
            </p>
          )}
          {entries.map((entry) =>
            entry.role === 'user' ? (
              <div
                key={entry.id}
                className="ml-auto max-w-[80%] rounded-md bg-primary p-3 text-sm text-white"
              >
                {entry.text}
              </div>
            ) : (
              <div key={entry.id} className="max-w-[90%] rounded-md border border-line p-4">
                <AssistantMessage response={entry.response} />
              </div>
            ),
          )}
          {isLoading && (
            <div
              className="max-w-[90%] space-y-2 rounded-md border border-line p-4"
              aria-label="El asistente está respondiendo"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex items-start gap-3 border-t border-line pt-4"
        >
          <div className="flex-1">
            <TextField
              label="Mensaje"
              placeholder="Escribe tu pregunta…"
              error={errors.message?.message}
              {...register('message')}
            />
          </div>
          <Button type="submit" loading={isLoading} className="mt-6">
            Enviar
          </Button>
        </form>
      </Card>
    </>
  );
};
