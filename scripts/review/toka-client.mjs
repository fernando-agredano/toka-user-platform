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

export async function authorizedRequest(method, path, accessToken, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${accessToken}`, ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(`${method} ${path} respondió HTTP ${response.status}${problem.detail ? `: ${problem.detail}` : ''}`);
  }
  return response.status === 204 ? null : response.json();
}

export const authorizedGet = (path, accessToken) => authorizedRequest('GET', path, accessToken);

export function run(main) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}
