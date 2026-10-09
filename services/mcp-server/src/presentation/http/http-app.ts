import { CorrelationIdMiddleware } from '@toka/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Express, type Request, type Response } from 'express';
import type { Authenticator } from '../../infrastructure/auth/token-authenticator';
import { type McpRuntime, createMcpServer } from '../mcp-server-factory';
import type { LogSink } from '../../application/ports/governance.port';

export interface HttpAppOptions {
  runtime: McpRuntime;
  authenticate: Authenticator;
  allowedOrigins: string[];
  isHealthy: () => Promise<boolean>;
  logger: LogSink;
}

const jsonRpcError = (res: Response, status: number, code: number, message: string): void => {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
};

/** Stateless Streamable HTTP endpoint: every POST is authenticated and served by its own server instance. */
export function createHttpApp({ runtime, authenticate, allowedOrigins, isHealthy, logger }: HttpAppOptions): Express {
  const app = express();
  const correlation = new CorrelationIdMiddleware();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(correlation.use.bind(correlation));

  app.get('/health', async (_req, res) => {
    const healthy = await isHealthy().catch(() => false);
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'error' });
  });

  // A browser page must not be able to drive this endpoint with the user's token (DNS rebinding protection).
  app.use('/mcp', (req, res, next) => {
    const origin = req.header('origin');
    if (origin && !allowedOrigins.includes(origin)) return jsonRpcError(res, 403, -32000, 'Origin not allowed');
    next();
  });

  app.post('/mcp', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
    let caller;
    try {
      caller = await authenticate(req.header('authorization'), req.ip ?? null);
    } catch {
      res.setHeader('WWW-Authenticate', 'Bearer realm="toka"');
      return jsonRpcError(res, 401, -32001, 'Unauthorized: send a valid access token as "Authorization: Bearer <token>"');
    }

    const server = createMcpServer(runtime, caller);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error instanceof Error ? error.message : String(error) }, 'MCP request failed');
      if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    }
  });

  // Stateless mode has no server-initiated stream and no sessions to terminate.
  const methodNotAllowed = (_req: Request, res: Response) => jsonRpcError(res, 405, -32000, 'Method not allowed');
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  return app;
}
