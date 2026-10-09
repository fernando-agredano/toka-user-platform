import { type JwtVerifier } from '@toka/common';
import { decodeJwt } from 'jose';
import type { Caller } from '../../application/dtos/caller';

export type Authenticator = (authorizationHeader: string | undefined, ip: string | null) => Promise<Caller>;

const BEARER = /^Bearer\s+(\S+)$/i;

function tokenFrom(header: string | undefined): string {
  const token = header?.match(BEARER)?.[1];
  if (!token) throw new Error('Missing bearer token');
  return token;
}

/** HTTP: the token is verified against auth-service's JWKS (signature, issuer, audience, expiry, revocation). */
export const jwksAuthenticator =
  (verifier: Pick<JwtVerifier, 'verify'>): Authenticator =>
  async (header, ip) => {
    const token = tokenFrom(header);
    const user = await verifier.verify(token);
    return {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      authorization: `Bearer ${token}`,
      ip,
      transport: 'http',
      expiresAt: user.exp,
    };
  };

/**
 * stdio: the process runs on the user's own machine with their own token, so it is only decoded to learn who is calling.
 * It is not trusted: every downstream service verifies the signature again before doing anything.
 */
export const decodingAuthenticator: Authenticator = async (header) => {
  const token = tokenFrom(header);
  const claims = decodeJwt(token);
  if (!claims.sub) throw new Error('Token has no subject');
  return {
    userId: claims.sub,
    email: String(claims.email ?? ''),
    roles: Array.isArray(claims.roles) ? (claims.roles as string[]) : [],
    permissions: Array.isArray(claims.permissions) ? (claims.permissions as string[]) : [],
    authorization: `Bearer ${token}`,
    ip: null,
    transport: 'stdio',
    expiresAt: claims.exp,
  };
};
