import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../jwt.strategy';

describe('JwtStrategy', () => {
  const authService = { isBlacklisted: jest.fn() };
  const payload = { sub: 'user-1', username: 'admin', role: 'admin', jti: 'token-1' };
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    strategy = new JwtStrategy(authService as never);
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns the authenticated user for an active token', async () => {
    authService.isBlacklisted.mockResolvedValue(false);
    await expect(strategy.validate(payload)).resolves.toEqual({ id: 'user-1', username: 'admin', role: 'admin' });
    expect(authService.isBlacklisted).toHaveBeenCalledWith('token-1');
  });

  it('rejects a blacklisted token', async () => {
    authService.isBlacklisted.mockResolvedValue(true);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed when Redis is unavailable', async () => {
    authService.isBlacklisted.mockRejectedValue(new Error('redis unavailable'));
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
