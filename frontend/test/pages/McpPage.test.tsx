import { McpPage } from '@/pages/McpPage';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem, makeSession } from '../utils/fixtures';
import { renderWithProviders } from '../utils/render';

const AUDIT_URL = '/api/audit';

const mcpEvent = (id: string, tool: string, outcome: string, durationMs: number) => ({
  eventId: id,
  type: 'mcp.tool.invoked',
  version: 1,
  occurredAt: new Date().toISOString(),
  correlationId: `corr-${id}`,
  source: 'mcp-server',
  actor: { userId: '00000000-0000-4000-8000-000000000001', ip: null },
  data: { tool, outcome, durationMs, transport: 'http', arguments: {} },
});

const renderPage = () =>
  renderWithProviders(<McpPage />, { path: '/mcp', session: makeSession(['audit:read']) });

describe('McpPage', () => {
  it('resume las llamadas: total, herramientas más usadas y últimas invocaciones', async () => {
    server.use(
      http.get(AUDIT_URL, () =>
        HttpResponse.json({
          items: [
            mcpEvent('e1', 'list_roles', 'success', 100),
            mcpEvent('e2', 'list_roles', 'denied', 20),
            mcpEvent('e3', 'assign_role', 'success', 60),
          ],
          page: 1,
          limit: 100,
          total: 44,
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText('44')).toBeInTheDocument();
    expect(screen.getAllByText('67%').length).toBeGreaterThan(0);
    const tools = within(
      screen.getByRole('heading', { name: 'Herramientas más usadas' }).closest('section') as HTMLElement,
    );
    expect(tools.getByText('list_roles')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Últimas invocaciones' })).toBeInTheDocument();
    expect(screen.getAllByText('Denegada').length).toBeGreaterThan(0);
  });

  it('muestra cómo conectar un asistente con la URL del servidor y el comando', async () => {
    server.use(http.get(AUDIT_URL, () => HttpResponse.json({ items: [], page: 1, limit: 100, total: 0 })));
    renderPage();

    expect(
      await screen.findByText('Aún no hay llamadas MCP. Conecta un asistente para empezar.'),
    ).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/mcp`)).toBeInTheDocument();
    expect(screen.getByText(/claude mcp add --transport http toka/)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando falla la carga de llamadas', async () => {
    server.use(
      http.get(AUDIT_URL, () =>
        HttpResponse.json(makeProblem(500, 'Fallo interno'), {
          status: 500,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText('No se pudieron cargar los datos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
