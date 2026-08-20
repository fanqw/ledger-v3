import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    session: jest.fn(),
  };
  const response = {
    status: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.NODE_ENV;
    controller = new AuthController(authService as unknown as AuthService);
  });

  describe('login', () => {
    it('returns a validation error without calling the service', async () => {
      const result = await controller.login(
        { username: '', password: '' },
        response as unknown as Response,
      );

      expect(response.status).toHaveBeenCalledWith(422);
      expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('sets refresh cookies and returns an access token', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenMaxAge: 604800000,
      });

      await expect(controller.login(
        { username: 'alice', password: 'valid-password' },
        response as unknown as Response,
      )).resolves.toEqual({ success: true, data: { accessToken: 'access-token' } });
      expect(authService.login).toHaveBeenCalledWith('alice', 'valid-password');
      expect(response.cookie).toHaveBeenNthCalledWith(1, 'refreshToken', 'refresh-token', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 604800000,
        secure: false,
      });
      expect(response.cookie).toHaveBeenNthCalledWith(2, 'refreshTokenPresent', '1', {
        httpOnly: false,
        sameSite: 'strict',
        path: '/',
        maxAge: 604800000,
        secure: false,
      });
    });

    it('marks login cookies secure in production', async () => {
      process.env.NODE_ENV = 'production';
      authService.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenMaxAge: 604800000,
      });

      await controller.login(
        { username: 'alice', password: 'valid-password' },
        response as unknown as Response,
      );

      expect(response.cookie).toHaveBeenNthCalledWith(
        1,
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ secure: true }),
      );
      expect(response.cookie).toHaveBeenNthCalledWith(
        2,
        'refreshTokenPresent',
        '1',
        expect.objectContaining({ secure: true }),
      );
    });

    it('propagates authentication failures', async () => {
      authService.login.mockRejectedValue(new Error('invalid credentials'));

      await expect(controller.login(
        { username: 'alice', password: 'valid-password' },
        response as unknown as Response,
      )).rejects.toThrow('invalid credentials');
    });
  });

  describe('logout', () => {
    it('revokes a bearer token and clears refresh cookies', async () => {
      const request = { headers: { authorization: 'Bearer access-token' } } as Request;

      await expect(controller.logout(request, response as unknown as Response)).resolves.toEqual({
        success: true,
        data: null,
      });
      expect(authService.logout).toHaveBeenCalledWith('access-token');
      expect(response.clearCookie).toHaveBeenNthCalledWith(1, 'refreshToken', { path: '/api/auth' });
      expect(response.clearCookie).toHaveBeenNthCalledWith(2, 'refreshTokenPresent', { path: '/' });
    });

    it('clears cookies without calling the service when no token is present', async () => {
      await controller.logout({ headers: {} } as Request, response as unknown as Response);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(response.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    [{ cookies: { refreshToken: 'token' } }, true],
    [{ cookies: {} }, false],
    [{}, false],
  ])('reports refresh cookie presence', (request, expected) => {
    expect(controller.refreshStatus(request as Request)).toEqual({
      success: true,
      data: { hasRefreshToken: expected },
    });
  });

  describe('refresh', () => {
    it('returns 401 when the refresh cookie is missing', async () => {
      const result = await controller.refresh(
        { cookies: {} } as Request,
        response as unknown as Response,
      );

      expect(response.status).toHaveBeenCalledWith(401);
      expect(result).toMatchObject({ success: false, error: { code: 'TOKEN_EXPIRED' } });
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('rotates refresh cookies and returns a new access token', async () => {
      process.env.NODE_ENV = 'production';
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        refreshTokenMaxAge: 604800000,
      });

      await expect(controller.refresh(
        { cookies: { refreshToken: 'old-refresh-token' } } as unknown as Request,
        response as unknown as Response,
      )).resolves.toEqual({ success: true, data: { accessToken: 'new-access-token' } });
      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(response.cookie).toHaveBeenNthCalledWith(
        1,
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true, secure: true, path: '/api/auth' }),
      );
      expect(response.cookie).toHaveBeenNthCalledWith(
        2,
        'refreshTokenPresent',
        '1',
        expect.objectContaining({ httpOnly: false, secure: true, path: '/' }),
      );
    });

    it('does not mark rotated cookies secure outside production', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        refreshTokenMaxAge: 604800000,
      });

      await controller.refresh(
        { cookies: { refreshToken: 'old-refresh-token' } } as unknown as Request,
        response as unknown as Response,
      );

      expect(response.cookie).toHaveBeenNthCalledWith(
        1,
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({ secure: false }),
      );
      expect(response.cookie).toHaveBeenNthCalledWith(
        2,
        'refreshTokenPresent',
        '1',
        expect.objectContaining({ secure: false }),
      );
    });

    it('propagates refresh failures', async () => {
      authService.refresh.mockRejectedValue(new Error('refresh failed'));

      await expect(controller.refresh(
        { cookies: { refreshToken: 'refresh-token' } } as unknown as Request,
        response as unknown as Response,
      )).rejects.toThrow('refresh failed');
    });
  });

  it('returns the current session user', async () => {
    authService.session.mockResolvedValue({ success: true, data: { id: 'user-1' } });

    await expect(controller.session({ user: { id: 'user-1' } } as Request & { user: { id: string } }))
      .resolves.toEqual({ success: true, data: { id: 'user-1' } });
    expect(authService.session).toHaveBeenCalledWith('user-1');
  });
});
