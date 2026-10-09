import { jwtVerify } from 'jose';
import { blacklistKey, JwtVerifier } from '../src/auth/jwt-verifier.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'jwks-resolver'),
  jwtVerify: jest.fn(),
}));

const options = {
  jwksUrl: 'http://auth-service:3001/api/auth/.well-known/jwks.json',
  issuer: 'toka-auth',
  audience: 'toka-api',
};

const buildVerifier = (exists = 0) => {
  const redis = { exists: jest.fn().mockResolvedValue(exists) };
  return { verifier: new JwtVerifier(options, redis as never), redis };
};

const mockedJwtVerify = jwtVerify as unknown as jest.Mock;

describe('JwtVerifier', () => {
  beforeEach(() => mockedJwtVerify.mockReset());

  it('verifies the token against the issuer, audience and RS256 and maps the claims', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'u1',
        email: 'a@toka.local',
        roles: ['USER'],
        permissions: ['ai:use'],
        jti: 'jti-1',
        exp: 1700000000,
      },
    });
    const { verifier } = buildVerifier();

    const result = await verifier.verify('token');

    expect(mockedJwtVerify).toHaveBeenCalledWith('token', 'jwks-resolver', {
      issuer: 'toka-auth',
      audience: 'toka-api',
      algorithms: ['RS256'],
    });
    expect(result).toEqual({
      userId: 'u1',
      email: 'a@toka.local',
      roles: ['USER'],
      permissions: ['ai:use'],
      jti: 'jti-1',
      exp: 1700000000,
    });
  });

  it('defaults roles, permissions and email when the claims are absent', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { sub: 'u1', jti: 'jti-1', exp: 1 } });
    const { verifier } = buildVerifier();

    const result = await verifier.verify('token');

    expect(result).toMatchObject({ email: '', roles: [], permissions: [] });
  });

  it('ignores non-array role and permission claims', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'u1', jti: 'jti-1', exp: 1, roles: 'ADMIN', permissions: 'users:write' },
    });
    const { verifier } = buildVerifier();

    const result = await verifier.verify('token');

    expect(result).toMatchObject({ roles: [], permissions: [] });
  });

  it('rejects tokens missing sub, jti or exp', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { sub: 'u1', exp: 1 } });
    const { verifier } = buildVerifier();

    await expect(verifier.verify('token')).rejects.toThrow('Token is missing required claims');
  });

  it('rejects revoked tokens found in the Redis blacklist', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { sub: 'u1', jti: 'jti-9', exp: 1 } });
    const { verifier, redis } = buildVerifier(1);

    await expect(verifier.verify('token')).rejects.toThrow('Token has been revoked');
    expect(redis.exists).toHaveBeenCalledWith(blacklistKey('jti-9'));
  });

  it('propagates signature and expiration errors from jose', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('signature verification failed'));
    const { verifier } = buildVerifier();

    await expect(verifier.verify('token')).rejects.toThrow('signature verification failed');
  });
});

describe('blacklistKey', () => {
  it('namespaces the revoked jti', () => {
    expect(blacklistKey('abc')).toBe('blacklist:jti:abc');
  });
});
