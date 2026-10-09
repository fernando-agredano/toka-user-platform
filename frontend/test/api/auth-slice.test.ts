import {
  authReducer,
  selectAccessToken,
  selectAuthStatus,
  selectCurrentUser,
  sessionCleared,
  sessionStarted,
} from '@/api/auth-slice';
import { makeSession } from '../utils/fixtures';

describe('auth slice', () => {
  it('arranca en bootstrapping, sin token ni usuario', () => {
    const state = authReducer(undefined, { type: '@@init' });

    expect(state).toEqual({ status: 'bootstrapping', accessToken: null, user: null });
  });

  it('guarda token y usuario al iniciar sesión', () => {
    const session = makeSession(['users:read']);

    const state = authReducer(undefined, sessionStarted(session));

    expect(state.status).toBe('authenticated');
    expect(state.accessToken).toBe(session.accessToken);
    expect(state.user).toEqual(session.user);
  });

  it('reemplaza la sesión anterior al renovar el token', () => {
    const first = authReducer(undefined, sessionStarted(makeSession(['users:read'])));
    const renewed = { ...makeSession(['users:read', 'users:write']), accessToken: 'renewed-token' };

    const state = authReducer(first, sessionStarted(renewed));

    expect(state.accessToken).toBe('renewed-token');
    expect(state.user?.permissions).toEqual(['users:read', 'users:write']);
  });

  it('al cerrar sesión limpia token y usuario y queda anónimo', () => {
    const authenticated = authReducer(undefined, sessionStarted(makeSession(['ai:use'])));

    const state = authReducer(authenticated, sessionCleared());

    expect(state).toEqual({ status: 'anonymous', accessToken: null, user: null });
  });

  it('expone selectores coherentes con el estado', () => {
    const session = makeSession();
    const rootState = { auth: authReducer(undefined, sessionStarted(session)) };

    expect(selectAuthStatus(rootState)).toBe('authenticated');
    expect(selectAccessToken(rootState)).toBe(session.accessToken);
    expect(selectCurrentUser(rootState)).toEqual(session.user);
  });
});
