import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { getJwtSecrets } from './auth.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {
    const secrets = getJwtSecrets();
    this.jwtAccessSecret = secrets.accessSecret;
    this.jwtRefreshSecret = secrets.refreshSecret;
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: ERROR_MESSAGES[ERROR_CODES.INVALID_CREDENTIALS] },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: ERROR_MESSAGES[ERROR_CODES.INVALID_CREDENTIALS] },
      });
    }

    const jti = uuidv4();
    const payload = { sub: user.id, username: user.username, role: user.role, jti };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtAccessSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      },
    );

    await this.redis.set(`refresh:${user.id}:${jti}`, '1', 7 * 86400);
    // Revoke old refresh tokens for this user (rotation)
    try {
      const oldKeys = await this.redis.keysOrThrow(`refresh:${user.id}:*`);
      const rotationErrors: unknown[] = [];
      for (const key of oldKeys) {
        if (key !== `refresh:${user.id}:${jti}`) {
          try {
            await this.redis.delOrThrow(key);
          } catch (error) {
            rotationErrors.push(error);
          }
        }
      }
      if (rotationErrors.length > 0) throw rotationErrors[0];
    } catch (error) {
      this.logger.warn('Failed to revoke old refresh tokens during login rotation', error);
    }

    return {
      accessToken,
      refreshToken,
      refreshTokenMaxAge: 7 * 86400 * 1000,
    };
  }

  async logout(accessToken: string) {
    let payload: { sub?: string; jti?: string; exp?: number } | undefined;
    try {
      const payload = this.jwtService.verify(accessToken, {
        secret: this.jwtAccessSecret,
        ignoreExpiration: true,
      });
    } catch {
      return;
    }

    const revocationErrors: unknown[] = [];
    const expiresIn = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 900;
    if (expiresIn > 0) {
      try {
        await this.redis.setOrThrow(`blacklist:${payload.jti}`, '1', expiresIn);
      } catch (error) {
        revocationErrors.push(error);
      }
    }

    // Clear all refresh tokens for this user; Redis failures must not be silent here.
    if (payload.sub) {
      try {
        const keys = await this.redis.keysOrThrow(`refresh:${payload.sub}:*`);
        for (const key of keys) {
          try {
            await this.redis.delOrThrow(key);
          } catch (error) {
            revocationErrors.push(error);
          }
        }
      } catch (error) {
        revocationErrors.push(error);
      }
    }

    if (revocationErrors.length > 0) throw revocationErrors[0];
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.jwtRefreshSecret,
      });

      const key = `refresh:${payload.sub}:${payload.jti}`;
      const exists = await this.redis.getOrThrow(key);
      if (!exists) {
        throw new UnauthorizedException({
          success: false,
          error: { code: ERROR_CODES.TOKEN_REVOKED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_REVOKED] },
        });
      }

      // Atomic rotation: delete old token + revoke all others
      await this.redis.delOrThrow(key);
      const oldKeys = await this.redis.keysOrThrow(`refresh:${payload.sub}:*`);
      const rotationErrors: unknown[] = [];
      for (const k of oldKeys) {
        try {
          await this.redis.delOrThrow(k);
        } catch (error) {
          rotationErrors.push(error);
        }
      }
      if (rotationErrors.length > 0) throw rotationErrors[0];

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.deletedAt) {
        throw new UnauthorizedException({
          success: false,
          error: { code: ERROR_CODES.TOKEN_REVOKED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_REVOKED] },
        });
      }

      const newJti = uuidv4();
      const newPayload = { sub: user.id, username: user.username, role: user.role, jti: newJti };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.jwtAccessSecret,
        expiresIn: '15m',
      });

      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, jti: newJti },
        {
          secret: this.jwtRefreshSecret,
          expiresIn: '7d',
        },
      );

      await this.redis.set(`refresh:${user.id}:${newJti}`, '1', 7 * 86400);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        refreshTokenMaxAge: 7 * 86400 * 1000,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        success: false,
        error: { code: ERROR_CODES.TOKEN_EXPIRED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_EXPIRED] },
      });
    }
  }

  async session(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ERROR_CODES.TOKEN_REVOKED, message: ERROR_MESSAGES[ERROR_CODES.TOKEN_REVOKED] },
      });
    }
    return { success: true, data: user };
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.getOrThrow(`blacklist:${jti}`);
    return !!result;
  }
}
