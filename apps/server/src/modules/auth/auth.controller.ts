import { Controller, Post, Get, Body, Req, UseGuards, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, Public } from './jwt-auth.guard';
import { loginSchema } from '@ledger-v3/shared/validators';
import { okNullBody, errorBody } from '../../common/swagger-schemas';

/** Swagger 文档：登录请求体 */
const loginBodySchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', description: '用户名', example: 'admin', minLength: 1 },
    password: { type: 'string', description: '密码', example: 'admin123', minLength: 1 },
  },
};

/** Swagger 文档：登录/刷新成功响应（含 accessToken） */
const tokenOkBody = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: '访问令牌（15 分钟有效），后续请求放请求头 Authorization: Bearer <token>',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMSIsInJvbGUiOiJhZG1pbiJ9.example',
        },
      },
    },
  },
};

/** Swagger 文档：refresh-status 响应（登录态探测） */
const refreshStatusOkBody = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        hasRefreshToken: { type: 'boolean', description: '浏览器是否持有 refreshToken cookie', example: true },
      },
    },
  },
};

/** Swagger 文档：session 响应（当前用户信息） */
const sessionOkBody = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '用户 ID', example: '507f1f77bcf86cd799439011' },
        username: { type: 'string', description: '用户名', example: 'admin' },
        role: { type: 'string', description: '角色', example: 'admin', enum: ['admin', 'user'] },
      },
    },
  },
};

/**
 * ==================== AuthController（认证模块）====================
 *
 * 职责：JWT 双令牌认证的 HTTP 入口——登录、登出、刷新、会话查询。
 *
 * 理解本模块是理解整个系统的钥匙，因为它定义了「谁能访问哪些接口」：
 *
 * 1. 全局守卫：JwtAuthGuard 在 AppModule 注册为全局守卫（APP_GUARD），
 *    「所有接口默认都需要登录」。只有带 @Public() 的方法才能匿名访问。
 *    - login / logout / refresh / refresh-status 都是 @Public()（此时还没有有效 token）
 *    - session 需要登录
 *
 * 2. 双令牌机制：
 *    - accessToken（15 分钟）：短效，放请求头 Authorization: Bearer <token>
 *    - refreshToken（7 天）：长效，存 HttpOnly cookie，用于 accessToken 过期后自动续期
 *
 * 3. 统一响应格式：{ success: boolean, data | error }
 *    - 成功：{ success: true, data }
 *    - 失败：{ success: false, error: { code, message } }
 *
 * 4. 为什么这里用 res.status() 而非抛异常？
 *    NestJS 默认异常过滤器会把响应体包成 { statusCode, message, error }，
 *    而前端 authFetch 直接读 data.error.message（扁平结构）。为了保持
 *    { success: false, error: {...} } 的形状，这里手动控制状态码 + 直接返回 body。
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login —— 登录
   *
   * 入参（body JSON）：{ username: string, password: string }
   * 鉴权：@Public() → 匿名可访问
   *
   * NestJS 机制学习点：
   * - @HttpCode(200)：POST 默认返回 201，这里显式改回 200
   * - @Res({ passthrough: true })：既能手动操作 response（设 cookie），
   *   又不完全接管响应（passthrough 让返回值照常作为响应体）
   *
   * 校验流程：
   *   1. loginSchema.safeParse(body) 用 Zod 校验入参（前后端共用同一 Schema）
   *   2. 校验失败 → 422 + VALIDATION_ERROR（携带首条校验信息）
   *   3. 校验通过 → authService.login() 真正验证用户名密码（见 service）
   *
   * 成功响应：
   *   - 设置两个 cookie：refreshToken(HttpOnly) + refreshTokenPresent(前端检测用)
   *   - body：{ success: true, data: { accessToken } }
   *
   * 错误码：422 VALIDATION_ERROR、401 INVALID_CREDENTIALS（service 抛出）
   */
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '登录' })
  @ApiBody({ description: '用户名 + 密码', schema: loginBodySchema })
  @ApiOkResponse({ description: '登录成功，返回 accessToken（refreshToken 写入了 HttpOnly cookie）', schema: tokenOkBody })
  @ApiResponse({ status: 401, description: '用户名或密码错误', schema: errorBody('INVALID_CREDENTIALS', '用户名或密码错误') })
  @ApiResponse({ status: 422, description: '参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY);
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
    res.cookie('refreshTokenPresent', '1', {
      httpOnly: false,
      sameSite: 'strict',
      path: '/',
      maxAge: result.refreshTokenMaxAge,
      secure: process.env.NODE_ENV === 'production',
    });

    return { success: true, data: { accessToken: result.accessToken } };
  }

  /**
   * POST /api/auth/logout —— 登出（撤销令牌）
   *
   * 入参：无 body，token 从请求头 Authorization 提取（Bearer xxx）
   * 流程：
   *   1. 取 accessToken
   *   2. 若有 → authService.logout()：把 accessToken 的 jti 拉入 Redis 黑名单，
   *      并清除该用户全部 refreshToken（见 service）
   *   3. 清除两个 cookie → 刷新页面后 refresh-status 会返回 hasRefreshToken=false
   * 响应：{ success: true, data: null }（始终 200，即使 token 无效也静默成功）
   */
  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '登出' })
  @ApiOkResponse({ description: '登出成功（撤销令牌并清除 cookie）', schema: okNullBody })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.clearCookie('refreshTokenPresent', { path: '/' });
    return { success: true, data: null };
  }

  /**
   * GET /api/auth/refresh-status —— 探测登录态（是否持有 refreshToken）
   *
   * 用途：前端应用启动时调用，据此决定跳转 /login 还是 /。
   * 入参：无（只读 cookie）
   * 响应：{ success: true, data: { hasRefreshToken: boolean } }
   * 注意：只检查 cookie 是否存在，不验证有效性——真正验证在 POST /auth/refresh
   */
  @Public()
  @Get('refresh-status')
  @HttpCode(200)
  @ApiOperation({ summary: '登录态探测' })
  @ApiOkResponse({ description: '登录态探测结果（前端启动时调用）', schema: refreshStatusOkBody })
  refreshStatus(@Req() req: Request) {
    return {
      success: true,
      data: { hasRefreshToken: Boolean(req.cookies?.refreshToken) },
    };
  }

  /**
   * POST /api/auth/refresh —— 用 refreshToken 换取新双令牌（自动续期）
   *
   * 触发时机：accessToken 过期（15 分钟）后，前端拦截 401 自动调用。
   * 入参：无 body，refreshToken 从 HttpOnly cookie 读取。
   *
   * 流程：
   *   1. cookie 无 refreshToken → 401 TOKEN_EXPIRED（"登录已过期"）
   *   2. authService.refresh()：验证签名 + 查 Redis 有效性 + 原子轮换（见 service）
   *   3. 重新设置新 cookie + 返回新 accessToken
   *
   * 错误码：401 TOKEN_EXPIRED / TOKEN_REVOKED
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: '刷新令牌' })
  @ApiOkResponse({ description: '刷新成功，返回新 accessToken（新 refreshToken 写入 cookie）', schema: tokenOkBody })
  @ApiResponse({ status: 401, description: 'refreshToken 缺失/过期/已撤销', schema: errorBody('TOKEN_EXPIRED', '登录已过期，请重新登录') })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
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
    res.cookie('refreshTokenPresent', '1', {
      httpOnly: false,
      sameSite: 'strict',
      path: '/',
      maxAge: result.refreshTokenMaxAge,
      secure: process.env.NODE_ENV === 'production',
    });

    return { success: true, data: { accessToken: result.accessToken } };
  }

  /**
   * GET /api/auth/session —— 获取当前登录用户信息
   *
   * 鉴权：需要有效 accessToken（JwtAuthGuard）。@UseGuards 是显式声明，全局已生效。
   * 入参：无（用户身份从 token 解析，token.sub = 用户 id）
   * 响应：{ success: true, data: { id, username, role } }
   * 注意：service 用 select 白名单，绝不返回 passwordHash
   */
  @UseGuards(JwtAuthGuard)
  @Get('session')
  @ApiOperation({ summary: '获取当前会话用户' })
  @ApiOkResponse({ description: '当前登录用户信息', schema: sessionOkBody })
  @ApiResponse({ status: 401, description: '未登录或令牌已失效', schema: errorBody('TOKEN_REVOKED', '令牌已失效') })
  async session(@Req() req: Request & { user: { id: string } }) {
    return this.authService.session(req.user.id);
  }
}
