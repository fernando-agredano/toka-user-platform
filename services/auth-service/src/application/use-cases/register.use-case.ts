import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Credential } from '../../domain/entities/credential';
import { userRegistered } from '../../domain/events/auth-events';
import { EmailAlreadyRegisteredError } from '../../domain/errors/domain-error';
import { CREDENTIAL_REPOSITORY, CredentialRepository } from '../../domain/repositories/credential.repository';
import { Email } from '../../domain/value-objects/email';
import { Password } from '../../domain/value-objects/password';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/ports';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Provided only by trusted internal callers (user-service) that already own the id. */
  userId?: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterInput): Promise<{ userId: string }> {
    const email = Email.create(input.email);
    const password = Password.create(input.password);
    if (await this.credentials.findByEmail(email)) throw new EmailAlreadyRegisteredError();

    const credential = Credential.create({
      id: input.userId ?? randomUUID(),
      email,
      passwordHash: await this.hasher.hash(password.value),
    });
    await this.credentials.save(credential, [
      userRegistered({
        userId: credential.id,
        email: email.value,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
      }),
    ]);
    return { userId: credential.id };
  }
}
