import { Controller, Post, Get, Body, Req, UseGuards, Res, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, Public } from './jwt-auth.guard';
import { loginSchema } from '@ledger-v3/shared/validators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      res.status(422);
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '参数不合法' },
      };
    }
    const result = await this.authService.login(parsed.data.username, parsed.data.password);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: result.refreshTokenMaxAge,
      secure: process.env.NODE_ENV === 'production',
    });

    return { success: true, data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return { success: true, data: null };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401);
      return {
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: '登录已过期，请重新登录' },
      };
    }
    const result = await this.authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: result.refreshTokenMaxAge,
      secure: process.env.NODE_ENV === 'production',
    });

    return { success: true, data: { accessToken: result.accessToken } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  async session(@Req() req: any) {
    return this.authService.session(req.user.id);
  }
}
