import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { requireEnv } from '../config/env';
import type { AuthenticatedRequest } from './authenticated-user';
import { JwtVerifier } from './jwt-verifier.service';

const ROLES_KEY = 'toka:roles';
const PERMISSIONS_KEY = 'toka:permissions';

/** The user must hold at least one of the listed roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
/** The user must hold every listed permission. */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly verifier: JwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    try {
      request.user = await this.verifier.verify(token);
      return true;
    } catch (error) {
      this.logger.warn(`Token rejected: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets) ?? [];
    const permissions = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, targets) ?? [];
    if (roles.length === 0 && permissions.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const hasRole = roles.length === 0 || roles.some((role) => user.roles.includes(role));
    const hasPermissions = permissions.every((permission) => user.permissions.includes(permission));
    if (!hasRole || !hasPermissions) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

/** Protects service-to-service endpoints (`/internal/*`) with the shared `x-internal-key` header. */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly expected = Buffer.from(requireEnv('INTERNAL_API_KEY'));

  canActivate(context: ExecutionContext): boolean {
    const provided = Buffer.from(context.switchToHttp().getRequest<Request>().header('x-internal-key') ?? '');
    if (provided.length !== this.expected.length || !timingSafeEqual(provided, this.expected)) {
      throw new UnauthorizedException('Invalid internal key');
    }
    return true;
  }
}
