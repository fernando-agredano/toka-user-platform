// Usage: npm run review:audit [-- <event type> [limit]]   e.g. npm run review:audit -- mcp.tool.invoked 5
import { authorizedGet, login, run } from './toka-client.mjs';

run(async () => {
  const [type, limit = '10'] = process.argv.slice(2);
  const accessToken = await login();

  const stats = await authorizedGet('/api/audit/stats', accessToken);
  console.log(`\n== Estadísticas (${stats.total} eventos, ${stats.failedLogins} logins fallidos, ${stats.lockedAccounts} cuentas bloqueadas)`);
  console.table(stats.byType);

  const query = new URLSearchParams({ limit, ...(type && { type }) });
  const page = await authorizedGet(`/api/audit?${query}`, accessToken);
  console.log(`== Últimos ${page.items.length} de ${page.total} eventos${type ? ` de tipo ${type}` : ''}`);
  console.table(
    page.items.map(({ occurredAt, type: eventType, source, actor }) => ({
      occurredAt,
      type: eventType,
      source,
      actor: actor.userId ?? '-',
    })),
  );
});
