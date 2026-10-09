import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import type { AccessTokenClaims, AccessTokenIssuer } from '../../application/ports/ports';
import { AUTH_CONFIG, AuthConfig } from '../config/auth-config';
import { RsaKeyStore, SIGNING_ALG } from './rsa-key-store';

@Injectable()
export class JoseAccessTokenIssuer implements AccessTokenIssuer {
  constructor(
    private readonly keys: RsaKeyStore,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async issue(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const { issuer, audience, accessTtlSeconds } = this.config.jwt;
    const token = await new SignJWT({ email: claims.email, roles: claims.roles, permissions: claims.permissions })
      .setProtectedHeader({ alg: SIGNING_ALG, kid: this.keys.keyId, typ: 'JWT' })
      .setSubject(claims.userId)
      .setJti(randomUUID())
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(`${accessTtlSeconds}s`)
      .sign(this.keys.signingKey);
    return { token, expiresIn: accessTtlSeconds };
  }
}
