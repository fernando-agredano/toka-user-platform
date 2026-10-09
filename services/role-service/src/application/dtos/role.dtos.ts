import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Role } from '../../domain/entities/role';

export class CreateRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string;
  @IsString() @MaxLength(255) description: string = '';
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) permissions!: string[];
}

export class UpdateRolePermissionsDto {
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) permissions!: string[];
}

export class AssignRoleDto {
  @IsUUID('4') roleId!: string;
}

export interface RoleView {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface UserAuthorization {
  roles: string[];
  permissions: string[];
}

export const toRoleView = (role: Role): RoleView => ({
  id: role.id,
  name: role.name.value,
  description: role.description,
  permissions: [...role.permissions],
  createdAt: role.createdAt.toISOString(),
});
