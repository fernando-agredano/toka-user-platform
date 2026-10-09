import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  assertSelfOrPermission,
} from '@toka/common';
import { CreateUserDto, ListUsersQueryDto, Page, UpdateUserDto, UserView } from '../../application/dtos/user.dtos';
import { ChangeUserStatusUseCase } from '../../application/use-cases/change-user-status.use-case';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly changeStatus: ChangeUserStatusUseCase,
  ) {}

  @Get()
  @Permissions('users:read')
  list(@Query() query: ListUsersQueryDto): Promise<Page<UserView>> {
    return this.listUsers.execute(query);
  }

  // Declared before ':id' so "me" is not parsed as a user id.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    return this.getUser.execute(user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    assertSelfOrPermission(user, id, 'users:read');
    return this.getUser.execute(id);
  }

  @Post()
  @Permissions('users:write')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    return this.createUser.execute({ ...dto, actorId: user.userId });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserView> {
    assertSelfOrPermission(user, id, 'users:write');
    return this.updateUser.execute({ userId: id, ...dto, actorId: user.userId });
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @Permissions('users:write')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    return this.changeStatus.execute({ userId: id, active: false, actorId: user.userId });
  }

  @Post(':id/activate')
  @HttpCode(200)
  @Permissions('users:write')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<UserView> {
    return this.changeStatus.execute({ userId: id, active: true, actorId: user.userId });
  }
}
