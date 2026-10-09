import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../domain/errors/domain-error';
import { userUpdated } from '../../domain/events/user-events';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { PersonName } from '../../domain/value-objects/person-name';
import { UserView, toUserView } from '../dtos/user.dtos';
import { USER_CACHE, UserCache } from '../ports/ports';

export interface UpdateUserInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  actorId: string | null;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_CACHE) private readonly cache: UserCache,
  ) {}

  async execute(input: UpdateUserInput): Promise<UserView> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    const changed = user.updateProfile({
      firstName: input.firstName === undefined ? undefined : PersonName.create(input.firstName, 'firstName'),
      lastName: input.lastName === undefined ? undefined : PersonName.create(input.lastName, 'lastName'),
    });
    if (changed) {
      await this.users.save(user, [userUpdated(user, input.actorId)]);
      await this.cache.invalidate(user.id);
    }
    return toUserView(user);
  }
}
