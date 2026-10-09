import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user';
import { userCreated } from '../../domain/events/user-events';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email';
import { PersonName } from '../../domain/value-objects/person-name';

export interface RegisterProfileInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Reacts to auth.user.registered. Idempotent: an existing profile (admin-created users) is left untouched. */
@Injectable()
export class RegisterProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(input: RegisterProfileInput): Promise<void> {
    if (await this.users.findById(input.userId)) return;

    const user = User.create({
      id: input.userId,
      email: Email.create(input.email),
      firstName: PersonName.create(input.firstName, 'firstName'),
      lastName: PersonName.create(input.lastName, 'lastName'),
    });
    await this.users.save(user, [userCreated(user, input.userId)]);
  }
}
