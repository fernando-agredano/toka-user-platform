import type { Session, UserView } from '@/@types/api';

export const makeSession = (permissions: string[] = []): Session => ({
  accessToken: 'test-access-token',
  expiresIn: 900,
  user: { id: 'user-1', email: 'ana@toka.local', roles: ['MANAGER'], permissions },
});

export const makeUser = (overrides: Partial<UserView> = {}): UserView => ({
  id: 'user-2',
  email: 'luis@toka.local',
  firstName: 'Luis',
  lastName: 'Pérez',
  status: 'ACTIVE',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  ...overrides,
});

export const makeProblem = (status: number, detail: string) => ({
  type: 'about:blank',
  title: 'Error',
  status,
  detail,
  correlationId: null,
});
