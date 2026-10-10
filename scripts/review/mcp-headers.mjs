// Invoked by Claude Code (`headersHelper`) on every MCP connection and after a 401/403:
// prints the Authorization header with a freshly issued admin token.
import { login, run } from './toka-client.mjs';

run(async () => {
  console.log(JSON.stringify({ Authorization: `Bearer ${await login()}` }));
});
