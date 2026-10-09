import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserListFilter, UserRepository } from '../../domain/repositories/user.repository';
import { Page, UserView, toUserView } from '../dtos/user.dtos';

@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(filter: UserListFilter): Promise<Page<UserView>> {
    const { items, total } = await this.users.list(filter);
    return { items: items.map(toUserView), page: filter.page, limit: filter.limit, total };
  }
}
