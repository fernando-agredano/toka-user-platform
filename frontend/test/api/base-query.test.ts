import { api } from '@/api/api';
import { selectAccessToken, selectAuthStatus, sessionStarted } from '@/api/auth-slice';
import { baseQueryWithReauth, isSessionExpired } from '@/api/base-query';
import { store } from '@/api/store';
import { usersApi } from '@/api/users.api';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { makeProblem, makeSession, makeUser } from '../utils/fixtures';

const USERS_URL = '/api/users';
const REFRESH_URL = '/api/auth/refresh';
const LOGIN_URL = '/api/auth/login';
const FRESH_TOKEN = 'fresh-access-token';

const page = { items: [makeUser()], page: 1, limit: 10, total: 1 };
const listUsers = (pageNumber: number) =>
  store.dispatch(usersApi.endpoints.listUsers.initiate({ page: pageNumber, limit: 10 }));

// Rejects any token other than the fresh one, like the gateway does with an expired access token.
const usersEndpointRequiringFreshToken = () =>
  http.get(USERS_URL, ({ request }) =>
    request.headers.get('authorization') === `Bearer ${FRESH_TOKEN}`
      ? HttpResponse.json(page)
      : HttpResponse.json(makeProblem(401, 'Token expired'), { status: 401 }),
  );

beforeEach(() => {
  store.dispatch(api.util.resetApiState());
  store.dispatch(sessionStarted(makeSession(['users:read'])));
});

describe('baseQueryWithReauth', () => {
  it('comparte una sola petición de refresh entre varias peticiones que reciben 401 a la vez', async () => {
    let refreshCalls = 0;
    server.use(
      usersEndpointRequiringFreshToken(),
      http.post(REFRESH_URL, () => {
        refreshCalls += 1;
        return HttpResponse.json({ ...makeSession(['users:read']), accessToken: FRESH_TOKEN });
      }),
    );

    const results = await Promise.all([listUsers(1), listUsers(2), listUsers(3)]);

    expect(refreshCalls).toBe(1);
    expect(results.map((result) => result.isSuccess)).toEqual([true, true, true]);
    expect(selectAccessToken(store.getState())).toBe(FRESH_TOKEN);
  });

  it('cierra la sesión y devuelve SESSION_EXPIRED cuando el refresh falla', async () => {
    server.use(
      usersEndpointRequiringFreshToken(),
      http.post(REFRESH_URL, () =>
        HttpResponse.json(makeProblem(401, 'Refresh token reused'), { status: 401 }),
      ),
    );

    // Called directly: logout wipes the RTK Query cache, so the error would not survive in a query result.
    const controller = new AbortController();
    const result = await baseQueryWithReauth(
      'users',
      {
        signal: controller.signal,
        abort: () => controller.abort(),
        dispatch: store.dispatch,
        getState: store.getState,
        endpoint: 'listUsers',
        type: 'query',
        extra: undefined,
      },
      {},
    );

    expect(isSessionExpired(result.error)).toBe(true);
    expect(selectAuthStatus(store.getState())).toBe('anonymous');
    expect(selectAccessToken(store.getState())).toBeNull();
  });

  it('no intenta refrescar cuando el login responde 401 por credenciales inválidas', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(LOGIN_URL, () => HttpResponse.json(makeProblem(401, 'Invalid credentials'), { status: 401 })),
      http.post(REFRESH_URL, () => {
        refreshCalls += 1;
        return HttpResponse.json(makeSession());
      }),
    );

    const { authApi } = await import('@/api/auth.api');
    const result = await store.dispatch(
      authApi.endpoints.login.initiate({ email: 'ana@toka.local', password: 'Wrong123!' }),
    );

    expect(result.error).toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
    expect(selectAuthStatus(store.getState())).toBe('authenticated');
  });
});
