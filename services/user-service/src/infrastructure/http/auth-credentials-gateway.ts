import { Inject, Injectable } from '@nestjs/common';
import { ResilientHttpClient } from '@toka/common';
import { isAxiosError } from 'axios';
import type { CredentialGateway, NewCredential } from '../../application/ports/ports';
import {
  AuthServiceUnavailableError,
  CredentialsRejectedError,
  EmailAlreadyExistsError,
} from '../../domain/errors/domain-error';
import type { UserConfig } from '../config/user-config';

export const AUTH_HTTP_CLIENT = Symbol('AUTH_HTTP_CLIENT');

export const createAuthHttpClient = (config: UserConfig) =>
  new ResilientHttpClient({
    name: 'auth-service',
    baseURL: config.authServiceUrl,
    headers: { 'x-internal-key': config.internalApiKey },
  });

/** Not retried: creating a credential is not idempotent (a retry after a timeout could hit a 409 on our own write). */
@Injectable()
export class AuthCredentialsGateway implements CredentialGateway {
  constructor(@Inject(AUTH_HTTP_CLIENT) private readonly http: Pick<ResilientHttpClient, 'request'>) {}

  async create(credential: NewCredential): Promise<void> {
    try {
      await this.http.request({ method: 'POST', url: '/api/auth/internal/credentials', data: credential });
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): Error {
    if (!isAxiosError(error) || !error.response) return new AuthServiceUnavailableError();
    const { status, data } = error.response;
    if (status === 409) return new EmailAlreadyExistsError();
    if (status === 400) {
      const detail = (data as { detail?: unknown } | undefined)?.detail;
      return new CredentialsRejectedError(typeof detail === 'string' ? detail : 'Credentials were rejected');
    }
    return new AuthServiceUnavailableError();
  }
}
