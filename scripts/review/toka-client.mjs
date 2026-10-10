// Shared helpers for the review scripts: gateway URL, admin login and authenticated GET.
export const BASE_URL = process.env.TOKA_API_URL ?? 'http://localhost:8080';
const CREDENTIALS = {
  email: process.env.TOKA_EMAIL ?? 'admin@toka.local',
  password: process.env.TOKA_PASSWORD ?? 'Admin123!',
};

export async function login() {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(CREDENTIALS),
    });
  } catch {
    throw new Error(`No se pudo conectar con ${BASE_URL}. ¿Está levantado el stack? (docker compose up -d)`);
  }
  if (!response.ok) throw new Error(`Login fallido para ${CREDENTIALS.email}: HTTP ${response.status}`);
  const { accessToken } = await response.json();
  return accessToken;
}

export async function authorizedGet(path, accessToken) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`GET ${path} respondió HTTP ${response.status}`);
  return response.json();
}

export function run(main) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}
