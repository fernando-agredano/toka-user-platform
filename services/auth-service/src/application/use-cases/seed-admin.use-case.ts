import { Inject, Injectable } from '@nestjs/common';
import { Credential } from '../../domain/entities/credential';
import { CREDENTIAL_REPOSITORY, CredentialRepository } from '../../domain/repositories/credential.repository';
import { Email } from '../../domain/value-objects/email';
import { Password } from '../../domain/value-objects/password';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/ports';

export const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class SeedAdminUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  /** Returns true if the admin was created. No event is emitted: user-service and role-service seed their own admin rows. */
  async execute(input: { email: string; password: string }): Promise<boolean> {
    if (await this.credentials.findById(ADMIN_USER_ID)) return false;

    const email = Email.create(input.email);
    const password = Password.create(input.password);
    await this.credentials.save(
      Credential.create({ id: ADMIN_USER_ID, email, passwordHash: await this.hasher.hash(password.value) }),
    );
    return true;
  }
}
