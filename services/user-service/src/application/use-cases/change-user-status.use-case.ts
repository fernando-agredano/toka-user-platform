import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../domain/errors/domain-error';
import { userActivated, userDeactivated } from '../../domain/events/user-events';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserView, toUserView } from '../dtos/user.dtos';
import { USER_CACHE, UserCache } from '../ports/ports';

export interface ChangeUserStatusInput {
  userId: string;
  active: boolean;
  actorId: string | null;
}

/** Idempotent: repeating a transition neither writes nor emits an event. */
@Injectable()
export class ChangeUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_CACHE) private readonly cache: UserCache,
  ) {}

  async execute(input: ChangeUserStatusInput): Promise<UserView> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    const changed = input.active ? user.activate() : user.deactivate();
    if (changed) {
      const event = input.active ? userActivated(user, input.actorId) : userDeactivated(user, input.actorId);
      await this.users.save(user, [event]);
      await this.cache.invalidate(user.id);
    }
    return toUserView(user);
  }
}
