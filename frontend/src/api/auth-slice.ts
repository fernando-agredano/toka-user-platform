import type { Session, SessionUser } from '@/@types/api';
import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  // Kept only in memory: a page reload loses it and the refresh cookie restores the session.
  accessToken: string | null;
  user: SessionUser | null;
}

const initialState: AuthState = { status: 'bootstrapping', accessToken: null, user: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted: (state, { payload }: PayloadAction<Session>) => {
      state.status = 'authenticated';
      state.accessToken = payload.accessToken;
      state.user = payload.user;
    },
    sessionCleared: () => ({ ...initialState, status: 'anonymous' as const }),
  },
});

export const { sessionStarted, sessionCleared } = authSlice.actions;
export const authReducer = authSlice.reducer;

type WithAuth = { auth: AuthState };
export const selectAuthStatus = (state: WithAuth) => state.auth.status;
export const selectAccessToken = (state: WithAuth) => state.auth.accessToken;
export const selectCurrentUser = (state: WithAuth) => state.auth.user;
