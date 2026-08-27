import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ERROR_CODES, ERROR_MESSAGES } from '@ledger-v3/shared/constants';
import { getJwtSecrets } from './auth.config';

/**
 * ==================== AuthService（认证业务逻辑）====================
 *
 * 职责：实现双令牌（accessToken + refreshToken）的签发、验证、撤销与轮换。
 * 存储依赖：Prisma（用户数据）+ Redis（refresh 会话 + 登出黑名单）。
 *
 * 核心概念（理解 JWT 认证的关键）：
 * - JWT payload：{ sub: 用户id, username, role, jti }
 *     jti = JWT ID（随机 UUID），是「这条令牌的唯一身份」，用于撤销与轮换追踪。
 * - Redis key 设计：
 *     refresh:<userId>:<jti> → 某条 refreshToken 的有效标记（值 '1'，TTL 7 天）
 *     blacklist:<jti>        → 已登出 accessToken 的黑名单（TTL = 其剩余有效期）
 * - 轮换（rotation）：每次刷新都签发全新 jti 并作废旧 token，防止旧 token 重放。
 *
 * 时序总览：
 *   POST /login   → 签发双令牌 + 写 refresh key + 作废该用户旧的 refresh keys
 *   POST /refresh → 校验 refresh key → 作废旧 key → 签发新双令牌 → 写新 key
 *   POST /logout  → accessToken 的 jti 进黑名单 + 清空该用户全部 refresh keys
 */
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

  /**
   * 登录：验证凭据 → 签发双令牌 → 记录 refresh 会话（含轮换）
   *
   * 步骤：
   *   1. 按 username 查用户（where 含 deletedAt: null → 软删除用户不能登录）
   *   2. bcrypt.compare 校验密码（库中存的是 bcrypt hash，绝不明文）
   *   3. 生成 jti = uuid，签发：
   *        accessToken   payload { sub, username, role, jti }，15 分钟
   *        refreshToken  payload 只含 { sub, jti }，7 天
   *   4. Redis 写 refresh:<id>:<jti> = '1'（TTL 7 天）作为 refreshToken 有效性凭据
   *   5. 轮换：作废该用户之前所有 refresh keys，防止旧 refreshToken 继续可用。
   *      注意：Redis 失败仅记 warn、不阻断登录（登录可用性 > 严格撤销）
   *
   * 抛出：401 INVALID_CREDENTIALS（用户不存在 / 密码错误——两者统一，
   *       避免向攻击者泄露「账号是否存在」）
   * 返回：{ accessToken, refreshToken, refreshTokenMaxAge }
   */
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

  /**
   * 登出：撤销 accessToken + 清除该用户全部 refresh 会话
   *
   * 步骤：
   *   1. 校验 accessToken（ignoreExpiration: true → 已过期的 token 也要能撤销其 jti）
   *      签名非法 → 直接 return，静默成功（登出一个无效 token 不算错误）
   *   2. 把 jti 写入 Redis 黑名单 blacklist:<jti>，TTL = token 剩余有效期
   *      （保证已登出的 accessToken 即使没过期也无法再访问受保护接口）
   *   3. 清空该用户所有 refresh:<sub>:* 键（让 refreshToken 全部失效）
   *
   * 与 login 不同：这里的 Redis 失败不静默——revocationErrors 非空则抛出，
   * 因为登出必须可靠生效（否则登出后 token 仍可用）。
   */
  async logout(accessToken: string) {
    let payload: { sub?: string; jti?: string; exp?: number } | undefined;
    try {
      payload = this.jwtService.verify(accessToken, {
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

  /**
   * 刷新：校验 refreshToken → 原子轮换 → 签发新双令牌
   *
   * 步骤：
   *   1. verify(refreshToken)：验签 + 验过期。失败 → 401 TOKEN_EXPIRED
   *   2. 查 Redis refresh:<sub>:<jti>：标记不存在 → 401 TOKEN_REVOKED
   *      （登录写入的标记没了 = 该 token 已被登出或轮换过）
   *   3. 原子轮换：删除当前 refresh key + 删除该用户其他所有 refresh key
   *      ——保证同一时刻只有一条 refreshToken 有效，重放旧 token 必然失败
   *   4. 查用户：不存在或已软删除 → 401 TOKEN_REVOKED
   *   5. 签发新双令牌（新 jti）+ 写新 refresh key
   *
   * 返回：{ accessToken, refreshToken, refreshTokenMaxAge }
   * 异常兜底：非 UnauthorizedException 的 JWT 错误统一转成 401 TOKEN_EXPIRED
   */
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

  /**
   * 会话查询：按 userId 返回用户公开信息
   * 入参：userId 来自 accessToken 的 sub（由 JwtStrategy 解析填充到 req.user）
   * 注意：select 白名单 { id, username, role }，绝不含 passwordHash
   * 找不到（用户已被删）→ 401 TOKEN_REVOKED
   */
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

  /**
   * 检查某个 jti 是否已被登出拉黑（供 JwtStrategy 每次请求校验时调用）
   * 命中黑名单 → 返回 true → 该 accessToken 被判无效（即使签名/有效期都正常）
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.getOrThrow(`blacklist:${jti}`);
    return !!result;
  }
}
