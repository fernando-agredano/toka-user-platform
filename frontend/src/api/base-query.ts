import type { Session } from '@/@types/api';
import {
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { selectAccessToken, sessionCleared, sessionStarted } from './auth-slice';

const API_BASE_URL = '/api';
const REFRESH_URL = `${API_BASE_URL}/auth/refresh`;
// A 401 here means bad credentials, not an expired token, so refreshing would be pointless.
const NO_REAUTH_PREFIXES = ['auth/login', 'auth/register', 'auth/refresh'];

const SESSION_EXPIRED_MESSAGE = 'SESSION_EXPIRED';
const sessionExpiredError: FetchBaseQueryError = { status: 'CUSTOM_ERROR', error: SESSION_EXPIRED_MESSAGE };

export const isSessionExpired = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as FetchBaseQueryError).status === 'CUSTOM_ERROR' &&
  (error as { error?: string }).error === SESSION_EXPIRED_MESSAGE;

let inFlightRefresh: Promise<Session | null> | null = null;

/**
 * Refresh tokens rotate on every use and reuse is treated as theft, so concurrent callers
 * (several 401s at once, or React StrictMode) must share a single request.
 */
export const refreshSession = (): Promise<Session | null> => {
  inFlightRefresh ??= fetch(REFRESH_URL, { method: 'POST', credentials: 'same-origin' })
    .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
    .catch(() => null)
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'same-origin',
  prepareHeaders: (headers, { getState }) => {
    const token = selectAccessToken(getState() as Parameters<typeof selectAccessToken>[0]);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const requestUrl = (args: string | FetchArgs) => (typeof args === 'string' ? args : args.url);

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const shouldRefresh =
    result.error?.status === 401 && !NO_REAUTH_PREFIXES.some((prefix) => requestUrl(args).startsWith(prefix));
  if (!shouldRefresh) return result;

  const session = await refreshSession();
  if (!session) {
    api.dispatch(sessionCleared());
    return { error: sessionExpiredError };
  }
  api.dispatch(sessionStarted(session));
  return rawBaseQuery(args, api, extraOptions);
};
