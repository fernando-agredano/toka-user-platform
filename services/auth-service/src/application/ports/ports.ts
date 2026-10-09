import type { DomainEvent } from '../../domain/events/auth-events';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');
export interface AccessTokenClaims {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}
export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }>;
}

export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');
export interface IssuedRefreshToken {
  token: string;
  ttlSeconds: number;
}
export interface RefreshTokenStore {
  issue(userId: string): Promise<IssuedRefreshToken>;
  /** Consumes the token and issues its replacement. Throws InvalidRefreshTokenError if unknown, expired or reused. */
  rotate(token: string): Promise<{ userId: string; next: IssuedRefreshToken }>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const TOKEN_BLACKLIST = Symbol('TOKEN_BLACKLIST');
export interface TokenBlacklist {
  /** Blocks the access token id until `expiresAt` (seconds since epoch). */
  blacklist(jti: string, expiresAt: number): Promise<void>;
}

export const LOGIN_ATTEMPT_TRACKER = Symbol('LOGIN_ATTEMPT_TRACKER');
export interface LoginAttemptTracker {
  isLocked(email: string): Promise<boolean>;
  registerFailure(email: string): Promise<{ attempts: number; justLocked: boolean }>;
  reset(email: string): Promise<void>;
}

export const PERMISSIONS_PROVIDER = Symbol('PERMISSIONS_PROVIDER');
export interface UserAuthorization {
  roles: string[];
  permissions: string[];
}
export interface PermissionsProvider {
  /** Throws PermissionsUnavailableError when role-service and the fallback cache are both unavailable. */
  getAuthorization(userId: string): Promise<UserAuthorization>;
}

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export interface EventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
}
