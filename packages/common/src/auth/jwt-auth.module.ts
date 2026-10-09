import { DynamicModule, Global, Module } from '@nestjs/common';
import { requireEnv } from '../config/env';
import { InternalApiKeyGuard, JwtAuthGuard, PermissionsGuard } from './guards';
import { JWT_VERIFIER_OPTIONS, JwtVerifier } from './jwt-verifier.service';
import { RedisModule } from './redis.module';

@Global()
@Module({})
export class JwtAuthModule {
  static register(): DynamicModule {
    return {
      module: JwtAuthModule,
      imports: [RedisModule],
      providers: [
        {
          provide: JWT_VERIFIER_OPTIONS,
          useFactory: () => ({
            jwksUrl: requireEnv('AUTH_JWKS_URL'),
            issuer: requireEnv('JWT_ISSUER'),
            audience: requireEnv('JWT_AUDIENCE'),
          }),
        },
        JwtVerifier,
        JwtAuthGuard,
        PermissionsGuard,
        InternalApiKeyGuard,
      ],
      exports: [JwtVerifier, JwtAuthGuard, PermissionsGuard, InternalApiKeyGuard],
    };
  }
}
