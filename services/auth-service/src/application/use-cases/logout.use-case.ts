import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_STORE, RefreshTokenStore, TOKEN_BLACKLIST, TokenBlacklist } from '../ports/ports';

export interface LogoutInput {
  jti: string;
  /** Access token expiration, seconds since epoch. */
  exp: number;
  refreshToken?: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_BLACKLIST) private readonly blacklist: TokenBlacklist,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: RefreshTokenStore,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.blacklist.blacklist(input.jti, input.exp);
    if (input.refreshToken) await this.refreshTokens.revoke(input.refreshToken);
  }
}
