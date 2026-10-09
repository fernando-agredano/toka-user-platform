import type { Session } from '@/@types/api';
import type { LoginValues, NewAccountValues } from '@/validators/account';
import { api } from './api';
import { sessionCleared, sessionStarted } from './auth-slice';

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<Session, LoginValues>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        // Failures are already surfaced as a toast by the store's error listener.
        await queryFulfilled.then(
          ({ data }) => dispatch(sessionStarted(data)),
          () => undefined,
        );
      },
    }),
    register: build.mutation<{ userId: string }, NewAccountValues>({
      query: (body) => ({ url: 'auth/register', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      // Local session ends even if the server call fails (expired token, network).
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        await queryFulfilled.catch(() => undefined);
        dispatch(sessionCleared());
      },
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useLogoutMutation } = authApi;
