import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { User, UserStatus } from '../../domain/entities/user';

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(254) email!: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
}

export class ListUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: UserStatus;
}

export interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export const toUserView = (user: User): UserView => ({
  id: user.id,
  email: user.email.value,
  firstName: user.firstName.value,
  lastName: user.lastName.value,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
