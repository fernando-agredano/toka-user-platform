import { neutralizeText } from '../../domain/services/untrusted-text';
import type { Caller } from '../dtos/caller';
import type { UsersGateway } from '../ports/gateways.port';

/** Backs the `toka://me` resource: the current profile plus what the token allows. */
export class GetMeUseCase {
  constructor(private readonly users: UsersGateway) {}

  async execute(caller: Caller): Promise<Record<string, unknown>> {
    const profile = await this.users.me(caller.authorization);
    return {
      id: profile.id,
      email: profile.email,
      firstName: neutralizeText(profile.firstName, 80),
      lastName: neutralizeText(profile.lastName, 80),
      status: profile.status,
      roles: caller.roles,
      permissions: caller.permissions,
      tokenExpiresAt: caller.expiresAt ? new Date(caller.expiresAt * 1000).toISOString() : null,
    };
  }
}
