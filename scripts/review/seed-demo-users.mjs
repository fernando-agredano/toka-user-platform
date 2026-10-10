// Usage: npm run review:seed
// Creates two demo accounts so each role can be tried out: a MANAGER and a plain USER. Safe to run twice.
import { BASE_URL, authorizedGet, authorizedRequest, login, run } from './toka-client.mjs';

const DEMO_PASSWORD = 'Demo1234!';
const PROFILE_LOOKUP_ATTEMPTS = 8;
const PROFILE_LOOKUP_DELAY_MS = 750;
const DEFAULT_ROLE = 'USER';
const DEMO_USERS = [
  { email: 'manager@toka.local', firstName: 'Gerente', lastName: 'Demo', extraRole: 'MANAGER' },
  { email: 'user@toka.local', firstName: 'Usuario', lastName: 'Demo', extraRole: null },
];

async function registerOrFind({ email, firstName, lastName }, adminToken) {
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, firstName, lastName }),
  });
  if (response.ok) return { userId: (await response.json()).userId, created: true };
  if (response.status !== 409) throw new Error(`No se pudo registrar ${email}: HTTP ${response.status}`);
  // The profile is created asynchronously (by an event) right after registration, so give it a moment.
  for (let attempt = 0; attempt < PROFILE_LOOKUP_ATTEMPTS; attempt += 1) {
    const { items } = await authorizedGet(`/api/users?search=${encodeURIComponent(email)}`, adminToken);
    const existing = items.find((user) => user.email === email);
    if (existing) return { userId: existing.id, created: false };
    await new Promise((resolve) => setTimeout(resolve, PROFILE_LOOKUP_DELAY_MS));
  }
  throw new Error(`${email} ya existe pero no se encontró en el listado de usuarios.`);
}

// role-service assigns USER asynchronously after registration; logging in before that gives a session with no permissions.
async function waitForDefaultRole(userId, adminToken) {
  for (let attempt = 0; attempt < PROFILE_LOOKUP_ATTEMPTS; attempt += 1) {
    const roles = await authorizedGet(`/api/roles/users/${userId}`, adminToken);
    if (roles.some((role) => role.name === DEFAULT_ROLE)) return;
    await new Promise((resolve) => setTimeout(resolve, PROFILE_LOOKUP_DELAY_MS));
  }
  throw new Error(`El rol ${DEFAULT_ROLE} aún no se asignó a ${userId}. Vuelve a ejecutar el comando en unos segundos.`);
}

run(async () => {
  const adminToken = await login();
  const roles = await authorizedGet('/api/roles', adminToken);

  for (const demoUser of DEMO_USERS) {
    const { userId, created } = await registerOrFind(demoUser, adminToken);
    await waitForDefaultRole(userId, adminToken);
    let roleNote = DEFAULT_ROLE;
    if (demoUser.extraRole) {
      const role = roles.find((candidate) => candidate.name === demoUser.extraRole);
      if (!role) throw new Error(`No existe el rol ${demoUser.extraRole}.`);
      await authorizedRequest('POST', `/api/roles/users/${userId}/assign`, adminToken, { roleId: role.id });
      roleNote = `${DEFAULT_ROLE} + ${demoUser.extraRole}`;
    }
    console.log(`${created ? 'Creado ' : 'Ya existía'}  ${demoUser.email}  (${roleNote})`);
  }
  console.log(`\nContraseña de las cuentas demo: ${DEMO_PASSWORD}`);
});
