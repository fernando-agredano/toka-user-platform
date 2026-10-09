import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { Email } from '../../domain/value-objects/email';
import { PersonName } from '../../domain/value-objects/person-name';

export const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class SeedAdminUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /** Returns true if the admin profile was created. No event: auth and role seed their own admin rows. */
  async execute(input: { email: string }): Promise<boolean> {
    if (await this.users.findById(ADMIN_USER_ID)) return false;

    await this.users.save(
      User.create({
        id: ADMIN_USER_ID,
        email: Email.create(input.email),
        firstName: PersonName.create('Admin', 'firstName'),
        lastName: PersonName.create('Toka', 'lastName'),
      }),
    );
    return true;
  }
}
