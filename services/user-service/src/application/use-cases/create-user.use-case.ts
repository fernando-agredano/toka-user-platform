import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user';
import { EmailAlreadyExistsError } from '../../domain/errors/domain-error';
import { userCreated } from '../../domain/events/user-events';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email';
import { PersonName } from '../../domain/value-objects/person-name';
import { UserView, toUserView } from '../dtos/user.dtos';
import { CREDENTIAL_GATEWAY, CredentialGateway } from '../ports/ports';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  actorId: string | null;
}

/** Admin-created user: profile here, credentials in auth-service (REST, per the initial spec). */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CREDENTIAL_GATEWAY) private readonly credentials: CredentialGateway,
  ) {}

  async execute(input: CreateUserInput): Promise<UserView> {
    const user = User.create({
      id: randomUUID(),
      email: Email.create(input.email),
      firstName: PersonName.create(input.firstName, 'firstName'),
      lastName: PersonName.create(input.lastName, 'lastName'),
    });
    // Fail fast before provisioning credentials we would then have to orphan.
    if (await this.users.findByEmail(user.email)) throw new EmailAlreadyExistsError();

    await this.credentials.create({
      userId: user.id,
      email: user.email.value,
      password: input.password,
      firstName: user.firstName.value,
      lastName: user.lastName.value,
    });

    // auth-service also publishes auth.user.registered, so a failure below self-heals via the consumer;
    // and if that consumer already created the profile we keep it instead of emitting user.created twice.
    const existing = await this.users.findById(user.id);
    if (existing) return toUserView(existing);
    await this.users.save(user, [userCreated(user, input.actorId)]);
    return toUserView(user);
  }
}
