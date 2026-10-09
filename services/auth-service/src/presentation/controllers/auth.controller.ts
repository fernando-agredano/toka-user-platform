import { Body, Controller, Get, Header, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '@toka/common';
import type { CookieOptions, Request, Response } from 'express';
import { LoginDto, RegisterDto, Session, SessionWithRefresh } from '../../application/dtos/auth.dtos';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RefreshUseCase } from '../../application/use-cases/refresh.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { InvalidRefreshTokenError } from '../../domain/errors/domain-error';
import { AUTH_CONFIG, AuthConfig } from '../../infrastructure/config/auth-config';
import { RsaKeyStore } from '../../infrastructure/security/rsa-key-store';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/api/auth';
const CREDENTIAL_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller()
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly keys: RsaKeyStore,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post('register')
  @Throttle(CREDENTIAL_THROTTLE)
  register(@Body() dto: RegisterDto): Promise<{ userId: string }> {
    return this.registerUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(CREDENTIAL_THROTTLE)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Session> {
    const session = await this.loginUseCase.execute({
      ...dto,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    return this.startSession(res, session);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Session> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) throw new InvalidRefreshTokenError();
    return this.startSession(res, await this.refreshUseCase.execute({ refreshToken }));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute({ jti: user.jti, exp: user.exp, refreshToken: this.readRefreshCookie(req) });
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('.well-known/jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  jwks() {
    return this.keys.getJwks();
  }

  private startSession(res: Response, { refreshToken, refreshTtlSeconds, ...session }: SessionWithRefresh): Session {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...this.cookieOptions(), maxAge: refreshTtlSeconds * 1000 });
    return session;
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'strict', secure: this.config.secureCookies, path: COOKIE_PATH };
  }
}
