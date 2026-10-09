import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  Permissions,
  PermissionsGuard,
  assertSelfOrPermission,
} from '@toka/common';
import { AssignRoleDto, CreateRoleDto, RoleView, UpdateRolePermissionsDto } from '../../application/dtos/role.dtos';
import { AssignRoleUseCase } from '../../application/use-cases/assign-role.use-case';
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case';
import { GetUserRolesUseCase } from '../../application/use-cases/get-user-roles.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { RevokeRoleUseCase } from '../../application/use-cases/revoke-role.use-case';
import { UpdateRolePermissionsUseCase } from '../../application/use-cases/update-role-permissions.use-case';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updatePermissions: UpdateRolePermissionsUseCase,
    private readonly getUserRoles: GetUserRolesUseCase,
    private readonly assignRole: AssignRoleUseCase,
    private readonly revokeRole: RevokeRoleUseCase,
  ) {}

  @Get()
  @Permissions('roles:read')
  list(): Promise<RoleView[]> {
    return this.listRoles.execute();
  }

  @Post()
  @Permissions('roles:write')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser): Promise<RoleView> {
    return this.createRole.execute({ ...dto, actorId: user.userId });
  }

  @Put(':id/permissions')
  @Permissions('roles:write')
  replacePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoleView> {
    return this.updatePermissions.execute({ roleId: id, permissions: dto.permissions, actorId: user.userId });
  }

  @Get('users/:userId')
  rolesOfUser(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthenticatedUser): Promise<RoleView[]> {
    assertSelfOrPermission(user, userId, 'roles:read');
    return this.getUserRoles.execute(userId);
  }

  @Post('users/:userId/assign')
  @HttpCode(204)
  @Permissions('roles:write')
  assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.assignRole.execute({ userId, roleId: dto.roleId, actorId: user.userId });
  }

  @Delete('users/:userId/roles/:roleId')
  @HttpCode(204)
  @Permissions('roles:write')
  revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.revokeRole.execute({ userId, roleId, actorId: user.userId });
  }
}
