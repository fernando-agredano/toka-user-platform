import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../domain/errors/domain-error';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserView, toUserView } from '../dtos/user.dtos';
import { USER_CACHE, UserCache } from '../ports/ports';

/** Cache-aside read (TTL and key live in the cache adapter). */
@Injectable()
export class GetUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_CACHE) private readonly cache: UserCache,
  ) {}

  async execute(userId: string): Promise<UserView> {
    const cached = await this.cache.get(userId);
    if (cached) return cached;

    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    const view = toUserView(user);
    await this.cache.set(view);
    return view;
  }
}
