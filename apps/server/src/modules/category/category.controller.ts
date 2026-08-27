import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoryService } from './category.service';
import { categorySchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：分类对象结构（响应 items 用） */
const categoryItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '分类 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '分类名称', example: '蔬菜' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '新鲜蔬菜类' },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建分类请求体（name 必填） */
const categoryCreateBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '分类名称（必填，自动去除首尾空格）', example: '蔬菜', maxLength: 100 },
    description: { type: 'string', description: '备注说明（可选）', example: '新鲜蔬菜类', maxLength: 500 },
  },
};

/** Swagger 文档：更新分类请求体（全部可选，只传需要修改的字段） */
const categoryUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: categoryCreateBodySchema.properties,
};

/**
 * ==================== CategoryController（分类模块）====================
 *
 * 职责：分类基础资料的 CRUD（增删改查）。这是本项目中「基础资料模块」的参考模板，
 * unit / commodity / purchase-place 均遵循同一套模式。
 *
 * 模式拆解（学一次，其余模块通用）：
 * 1. 类级装饰器三件套：
 *    - @ApiTags('Categories')     Swagger 分组
 *    - @ApiBearerAuth()           声明 Swagger「需携带 Bearer token」
 *    - @UseGuards(JwtAuthGuard)   请求必须先过 JWT 守卫（登录才能访问）
 *    - @Controller('categories')  路由前缀 → 所有端点挂在 /api/categories 下
 *      （app.setGlobalPrefix('api') 再加一重前缀）
 *
 * 2. ZodValidationPipe：每个端点参数（Query/Param/Body）都先过 Zod Schema 校验，
 *    校验失败自动返回 422 VALIDATION_ERROR，不用手写 if。
 *    - paginationSchema（分页查询）、idSchema（路径 id）、categorySchema（body）
 *
 * 3. 统一响应：controller 只做「校验 + 调 service + 包装 { success: true, data }」，
 *    业务规则（唯一性/软删除/引用检查）全部下沉到 service 层。
 *
 * 4. Swagger 文档装饰器（@ApiQuery/@ApiParam/@ApiBody/@ApiResponse）：
 *    只用于生成 /api/docs 文档（字段含义/类型/示例），不参与运行时校验。
 */
@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  /**
   * GET /api/categories?page=1&pageSize=10&keyword=蔬菜
   * 分类分页列表
   *
   * 学习点：
   * - @Query(new ZodValidationPipe(paginationSchema))：
   *   查询串先过 Zod 校验，page/pageSize 必须是合法数字，非法 → 422
   * - keyword 可选：按名称/备注模糊搜索（逻辑在 service 的 where.OR）
   * - 返回：{ success: true, data: { items, meta: { page, pageSize, total } } }
   *   items 已按 updatedAt 降序（最近更新的在前）
   */
  @Get()
  @ApiOperation({ summary: '获取分类分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配分类名称或备注（模糊、不区分大小写）', '蔬菜'))
  @ApiOkResponse({ description: '分类分页列表', schema: pagedOkBody(categoryItemSchema, '分类对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /**
   * GET /api/categories/:id —— 单个分类
   * 学习点：@Param('id', ZodValidationPipe(idSchema)) 路径参数过 idSchema 校验
   * 不存在 → 404 NOT_FOUND（service 抛出）
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个分类' })
  @ApiParam(idParam('id', '分类 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个分类', schema: okBody(categoryItemSchema) })
  @ApiResponse({ status: 404, description: '分类不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/categories —— 创建分类
   * 入参 body：{ name: string, description?: string }（过 categorySchema）
   * 名称重复 → 409 CATEGORY_EXISTS；名称会自动 trim 两端空白
   */
  @Post()
  @ApiOperation({ summary: '创建分类' })
  @ApiBody({ description: '分类信息', schema: categoryCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新分类', schema: okBody(categoryItemSchema) })
  @ApiResponse({ status: 409, description: '分类名称已存在', schema: errorBody('CATEGORY_EXISTS', '分类名称已存在') })
  @ApiResponse({ status: 422, description: '参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(categorySchema)) body: { name: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /**
   * PATCH /api/categories/:id —— 更新分类（部分更新）
   * 学习点：categorySchema.partial() 把所有字段变可选 → 只传要改的字段
   * 改名撞重 → 409 CATEGORY_EXISTS（排除自身，见 service）
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新分类' })
  @ApiParam(idParam('id', '分类 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（只传需要修改的）', schema: categoryUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后分类', schema: okBody(categoryItemSchema) })
  @ApiResponse({ status: 404, description: '分类不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '分类名称已存在', schema: errorBody('CATEGORY_EXISTS', '分类名称已存在') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(categorySchema.partial())) body: { name?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /**
   * DELETE /api/categories/:id —— 删除分类（软删除）
   * 学习点：
   * - @HttpCode(200)：DELETE 默认 204（无 body），这里要返回 body 所以改 200
   * - 「软删除」= 只写 deletedAt 时间戳，不物理删行 → 数据可追溯、可恢复
   * - 被商品引用的分类 → 409 CATEGORY_IN_USE（service 事务里检查）
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除分类（软删除）' })
  @ApiParam(idParam('id', '分类 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '分类不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '被商品引用，无法删除', schema: errorBody('CATEGORY_IN_USE', '该分类已被商品引用，无法删除') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
