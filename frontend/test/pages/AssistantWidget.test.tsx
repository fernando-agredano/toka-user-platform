import { AssistantWidget } from '@/components/assistant/AssistantWidget';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const CHAT_URL = '/api/ai/chat';

const chatResponse = {
  answer: 'La cuenta se bloquea tras 5 intentos fallidos [S1].',
  conversationId: '3b7e0f64-9d2a-4c1b-8f3e-5a6b7c8d9e0f',
  sources: [
    {
      id: 'S1',
      title: 'Política de contraseñas',
      section: 'Bloqueo por intentos fallidos',
      source: '02-politica-contrasenas-seguridad.md',
      score: 0.61,
      snippet: 'Tras 5 intentos fallidos...',
    },
  ],
  toolsUsed: [],
  metrics: {
    latencyMs: 120,
    inputTokens: 900,
    outputTokens: 60,
    costUsd: 0.0001,
    cached: false,
    provider: 'mock',
    model: 'mock',
  },
  quality: { score: 0.94, checks: { grounded: 0.9 } },
};

const ask = async (question: string) => {
  const user = userEvent.setup();
  if (screen.queryByRole('button', { name: 'Abrir asistente' })) {
    await user.click(screen.getByRole('button', { name: 'Abrir asistente' }));
  }
  await user.type(screen.getByLabelText('Mensaje'), question);
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
};

describe('AssistantWidget', () => {
  it('muestra la respuesta con las fuentes que cita, su sección y quién la generó', async () => {
    server.use(http.post(CHAT_URL, () => HttpResponse.json(chatResponse)));
    renderWithProviders(<AssistantWidget />);

    await ask('¿Cuántos intentos tengo?');

    expect(await screen.findByText(/se bloquea tras 5 intentos/)).toBeInTheDocument();
    expect(screen.getByText(/\[S1\] Política de contraseñas/)).toBeInTheDocument();
    expect(screen.getByText(/Bloqueo por intentos fallidos/)).toBeInTheDocument();
    expect(screen.getByText('mock')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
  });

  it('reenvía el conversationId de la respuesta anterior en el siguiente mensaje', async () => {
    const bodies: Array<{ message: string; conversationId?: string }> = [];
    server.use(
      http.post(CHAT_URL, async ({ request }) => {
        bodies.push((await request.json()) as { message: string; conversationId?: string });
        return HttpResponse.json(chatResponse);
      }),
    );
    renderWithProviders(<AssistantWidget />);

    await ask('primera pregunta');
    await screen.findByText(/se bloquea tras 5 intentos/);
    await ask('segunda pregunta');
    await screen.findAllByText(/se bloquea tras 5 intentos/);

    expect(bodies.map((body) => body.conversationId)).toEqual([undefined, chatResponse.conversationId]);
  });

  it('avisa que el asistente no está disponible cuando el servicio responde 503', async () => {
    server.use(
      http.post(CHAT_URL, () => HttpResponse.json(makeProblem(503, 'LLM unavailable'), { status: 503 })),
    );
    renderWithProviders(<AssistantWidget />);

    await ask('hola');

    expect(await screen.findByText(/no está disponible en este momento/)).toBeInTheDocument();
  });
});

describe('AssistantWidget launcher', () => {
  it('mantiene el chat oculto hasta abrirlo con el botón flotante', async () => {
    renderWithProviders(<AssistantWidget />);

    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir asistente' }));

    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toBeInTheDocument();
  });

  it('envía una pregunta sugerida al pulsarla', async () => {
    const bodies: string[] = [];
    server.use(
      http.post(CHAT_URL, async ({ request }) => {
        bodies.push(((await request.json()) as { message: string }).message);
        return HttpResponse.json(chatResponse);
      }),
    );
    renderWithProviders(<AssistantWidget />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Abrir asistente' }));
    await user.click(screen.getByRole('button', { name: '¿Cuál es la política de contraseñas?' }));

    expect(await screen.findByText(/se bloquea tras 5 intentos/)).toBeInTheDocument();
    expect(bodies).toEqual(['¿Cuál es la política de contraseñas?']);
  });
});
