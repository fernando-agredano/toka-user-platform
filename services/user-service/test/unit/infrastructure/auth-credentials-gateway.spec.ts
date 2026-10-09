import { AxiosError, AxiosHeaders } from 'axios';
import {
  AuthServiceUnavailableError,
  CredentialsRejectedError,
  EmailAlreadyExistsError,
} from '../../../src/domain/errors/domain-error';
import { AuthCredentialsGateway } from '../../../src/infrastructure/http/auth-credentials-gateway';

const credential = { userId: 'u1', email: 'a@b.co', password: 'Str0ng!Pass', firstName: 'A', lastName: 'B' };

const httpError = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const gatewayFailingWith = (error: unknown) =>
  new AuthCredentialsGateway({ request: jest.fn().mockRejectedValue(error) });

describe('AuthCredentialsGateway', () => {
  it('POSTs the credential to the internal auth endpoint', async () => {
    const request = jest.fn().mockResolvedValue({ userId: 'u1' });
    await new AuthCredentialsGateway({ request }).create(credential);
    expect(request).toHaveBeenCalledWith({ method: 'POST', url: '/api/auth/internal/credentials', data: credential });
  });

  it('maps 409 to EmailAlreadyExistsError', async () => {
    await expect(gatewayFailingWith(httpError(409)).create(credential)).rejects.toThrow(EmailAlreadyExistsError);
  });

  it('maps 400 to CredentialsRejectedError carrying auth-service detail', async () => {
    await expect(gatewayFailingWith(httpError(400, { detail: 'Password too weak' })).create(credential)).rejects.toThrow(
      'Password too weak',
    );
    await expect(gatewayFailingWith(httpError(400)).create(credential)).rejects.toThrow(CredentialsRejectedError);
  });

  it.each([
    ['5xx', httpError(500)],
    ['network failure', new AxiosError('timeout')],
    ['open circuit', Object.assign(new Error('breaker open'), { code: 'EOPENBREAKER' })],
  ])('maps %s to AuthServiceUnavailableError', async (_label, error) => {
    await expect(gatewayFailingWith(error).create(credential)).rejects.toThrow(AuthServiceUnavailableError);
  });
});
