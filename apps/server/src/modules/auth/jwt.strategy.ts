import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: { sub: string; username: string; role: string; jti: string }) {
    try {
      const blacklisted = await this.authService.isBlacklisted(payload.jti);
      if (blacklisted) {
        throw new UnauthorizedException({
          success: false,
          error: { code: ERROR_CODES.TOKEN_REVOKED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_REVOKED] },
        });
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn('Redis unavailable during token validation — fail-closed');
      throw new UnauthorizedException({
        success: false,
        error: { code: ERROR_CODES.TOKEN_REVOKED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_REVOKED] },
      });
    }
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
