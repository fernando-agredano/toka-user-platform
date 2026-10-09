import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticatedUser } from './authenticated-user';
import { REDIS_CLIENT } from './redis.module';

export const JWT_VERIFIER_OPTIONS = Symbol('JWT_VERIFIER_OPTIONS');

export interface JwtVerifierOptions {
  jwksUrl: string;
  issuer: string;
  audience: string;
}

/** Redis key holding a revoked access token id; written by auth-service on logout. */
export const blacklistKey = (jti: string) => `blacklist:jti:${jti}`;

const JWKS_CACHE_MS = 10 * 60 * 1000;

@Injectable()
export class JwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    @Inject(JWT_VERIFIER_OPTIONS) private readonly options: JwtVerifierOptions,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl), {
      cacheMaxAge: JWKS_CACHE_MS,
      timeoutDuration: 2000,
    });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.options.issuer,
      audience: this.options.audience,
      algorithms: ['RS256'],
    });

    if (!payload.sub || !payload.jti || !payload.exp) throw new Error('Token is missing required claims');
    if (await this.redis.exists(blacklistKey(payload.jti))) throw new Error('Token has been revoked');

    return {
      userId: payload.sub,
      email: String(payload.email ?? ''),
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
