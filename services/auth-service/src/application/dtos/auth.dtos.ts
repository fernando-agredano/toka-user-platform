import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(254) email!: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
}

export class CreateInternalCredentialDto extends RegisterDto {
  @IsOptional() @IsUUID('4') userId?: string;
}

export class LoginDto {
  @IsString() @IsNotEmpty() @MaxLength(254) email!: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password!: string;
}

export interface SessionUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

/** Session plus the opaque refresh token, which the controller moves into an httpOnly cookie. */
export interface SessionWithRefresh extends Session {
  refreshToken: string;
  refreshTtlSeconds: number;
}
