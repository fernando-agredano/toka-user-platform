export interface DomainEvent<T = Record<string, unknown>> {
  type: string;
  data: T;
  actor?: { userId?: string | null; ip?: string | null };
}

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

export const userRegistered = (data: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}): DomainEvent => ({
  type: 'auth.user.registered',
  data,
  actor: { userId: data.userId },
});

export const loginSucceeded = (userId: string, email: string, client: ClientContext): DomainEvent => ({
  type: 'auth.login.succeeded',
  data: { userId, email, userAgent: client.userAgent },
  actor: { userId, ip: client.ip },
});

export const loginFailed = (email: string, userId: string | null, client: ClientContext): DomainEvent => ({
  type: 'auth.login.failed',
  data: { email, userAgent: client.userAgent },
  actor: { userId, ip: client.ip },
});

export const loginLocked = (email: string, userId: string | null, client: ClientContext): DomainEvent => ({
  type: 'auth.login.locked',
  data: { email, userAgent: client.userAgent },
  actor: { userId, ip: client.ip },
});
