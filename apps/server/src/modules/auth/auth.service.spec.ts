import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn() }));

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    username: 'alice',
    passwordHash: 'hash',
    role: 'admin',
    deletedAt: null,
  };
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const redis = {
    set: jest.fn(),
    setOrThrow: jest.fn(),
    getOrThrow: jest.fn(),
    keysOrThrow: jest.fn(),
    delOrThrow: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };
  let service: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret-with-enough-entropy';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-enough-entropy';
  });

  beforeEach(() => {
    jest.resetAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('new-jti');
    service = new AuthService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      jwtService as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('rejects an unknown user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login('missing', 'password')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects an invalid password', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(user.username, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues tokens and rotates previous refresh tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      redis.keysOrThrow.mockResolvedValue([
        'refresh:user-1:old-jti',
        'refresh:user-1:new-jti',
      ]);

      await expect(service.login(user.username, 'password')).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenMaxAge: 7 * 86400 * 1000,
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, username: user.username, role: user.role, jti: 'new-jti' },
        { secret: process.env.JWT_SECRET, expiresIn: '15m' },
      );
      expect(redis.set).toHaveBeenCalledWith('refresh:user-1:new-jti', '1', 7 * 86400);
      expect(redis.delOrThrow).toHaveBeenCalledWith('refresh:user-1:old-jti');
      expect(redis.delOrThrow).not.toHaveBeenCalledWith('refresh:user-1:new-jti');
    });

    it('still logs in when cleanup of old refresh tokens fails', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      redis.keysOrThrow.mockResolvedValue(['refresh:user-1:old-jti']);
      redis.delOrThrow.mockRejectedValue(new Error('redis unavailable'));

      await expect(service.login(user.username, 'password')).resolves.toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('ignores malformed access tokens', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid token'); });

      await expect(service.logout('invalid')).resolves.toBeUndefined();
      expect(redis.setOrThrow).not.toHaveBeenCalled();
    });

    it('blacklists the access token and deletes all refresh tokens', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'access-jti', exp: 1100 });
      redis.keysOrThrow.mockResolvedValue(['refresh:user-1:a', 'refresh:user-1:b']);

      await service.logout('access-token');

      expect(redis.setOrThrow).toHaveBeenCalledWith('blacklist:access-jti', '1', 100);
      expect(redis.delOrThrow).toHaveBeenCalledTimes(2);
      jest.restoreAllMocks();
    });

    it('does not blacklist an already expired access token', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      jwtService.verify.mockReturnValue({ jti: 'access-jti', exp: 999 });

      await service.logout('access-token');

      expect(redis.setOrThrow).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('surfaces Redis revocation failures', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'access-jti' });
      redis.setOrThrow.mockRejectedValue(new Error('blacklist failed'));
      redis.keysOrThrow.mockRejectedValue(new Error('scan failed'));

      await expect(service.logout('access-token')).rejects.toThrow('blacklist failed');
    });
  });

  describe('refresh', () => {
    it('rejects invalid or expired refresh tokens', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('expired'); });

      await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects refresh tokens that are absent from Redis', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'old-jti' });
      redis.getOrThrow.mockResolvedValue(null);

      await expect(service.refresh('revoked-token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(redis.delOrThrow).not.toHaveBeenCalled();
    });

    it.each([null, { ...user, deletedAt: new Date() }])(
      'rejects refresh tokens for missing or deleted users',
      async (storedUser) => {
        jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'old-jti' });
        redis.getOrThrow.mockResolvedValue('1');
        redis.keysOrThrow.mockResolvedValue([]);
        prisma.user.findUnique.mockResolvedValue(storedUser);

        await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
      },
    );

    it('atomically rotates a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'old-jti' });
      redis.getOrThrow.mockResolvedValue('1');
      redis.keysOrThrow.mockResolvedValue(['refresh:user-1:other-jti']);
      prisma.user.findUnique.mockResolvedValue(user);
      jwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');

      await expect(service.refresh('refresh-token')).resolves.toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        refreshTokenMaxAge: 7 * 86400 * 1000,
      });
      expect(redis.delOrThrow).toHaveBeenNthCalledWith(1, 'refresh:user-1:old-jti');
      expect(redis.delOrThrow).toHaveBeenNthCalledWith(2, 'refresh:user-1:other-jti');
      expect(redis.set).toHaveBeenCalledWith('refresh:user-1:new-jti', '1', 7 * 86400);
    });

    it('maps rotation failures to an expired-token response', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'old-jti' });
      redis.getOrThrow.mockResolvedValue('1');
      redis.keysOrThrow.mockResolvedValue(['refresh:user-1:other-jti']);
      redis.delOrThrow.mockRejectedValueOnce(undefined).mockRejectedValueOnce(new Error('delete failed'));

      await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('session', () => {
    it('returns the public session user', async () => {
      const sessionUser = { id: user.id, username: user.username, role: user.role };
      prisma.user.findUnique.mockResolvedValue(sessionUser);

      await expect(service.session(user.id)).resolves.toEqual({ success: true, data: sessionUser });
    });

    it('rejects a session for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.session('missing')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it.each([
    ['1', true],
    [null, false],
  ])('reports blacklist membership', async (storedValue, expected) => {
    redis.getOrThrow.mockResolvedValue(storedValue);

    await expect(service.isBlacklisted('access-jti')).resolves.toBe(expected);
    expect(redis.getOrThrow).toHaveBeenCalledWith('blacklist:access-jti');
  });
});
