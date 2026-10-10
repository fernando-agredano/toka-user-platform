// Usage: npm run review:mcp
// Registers the `toka` MCP server in Claude Code (local scope). The token is not stored:
// Claude Code runs mcp-headers.mjs to get a fresh one on every connection, so it never expires on you.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BASE_URL, login, run } from './toka-client.mjs';

const SERVER_NAME = 'toka';
const headersHelperPath = fileURLToPath(new URL('./mcp-headers.mjs', import.meta.url));

run(async () => {
  await login(); // fail early, with a clear message, if the stack is down

  spawnSync('claude', ['mcp', 'remove', SERVER_NAME], { stdio: 'ignore' });
  const serverConfig = { type: 'http', url: `${BASE_URL}/mcp`, headersHelper: `node ${headersHelperPath}` };
  const added = spawnSync('claude', ['mcp', 'add-json', SERVER_NAME, JSON.stringify(serverConfig)], { encoding: 'utf8' });
  if (added.error) throw new Error('No se encontró el comando `claude`. Instala Claude Code primero.');
  if (added.status !== 0) throw new Error(`\`claude mcp add-json\` falló: ${added.stderr || added.stdout}`);

  console.log(`Servidor \`${SERVER_NAME}\` registrado en ${BASE_URL}/mcp con token automático.`);
  console.log('Abre una sesión nueva de Claude Code y escribe /mcp para ver el servidor.');
});
