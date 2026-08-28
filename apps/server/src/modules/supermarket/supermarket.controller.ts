import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupermarketService } from './supermarket.service';
import { supermarketSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：超市对象结构 */
const supermarketItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '超市 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '超市名称', example: '端氏' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '月结客户' },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建超市请求体（name 必填） */
const supermarketCreateBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '超市名称（必填，自动去除首尾空格）', example: '端氏', maxLength: 100 },
    description: { type: 'string', description: '备注说明（可选）', example: '月结客户', maxLength: 500 },
  },
};

/**
 * ==================== SupermarketController（超市模块）====================
 *
 * 职责：超市基础资料 CRUD（进货后消费的超市，独立无关联）。
 *
 * - 路由前缀 /supermarkets → 端点 /api/supermarkets
 * - 必填字段：{ name（超市名）}，描述可选
 * - 唯一性 = name（超市名）唯一
 * - 删除无引用检查（独立实体）
 *
 * 通用模式（守卫 / ZodValidationPipe / 统一响应）见 category.controller.ts。
 */
@ApiTags('Supermarkets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supermarkets')
export class SupermarketController {
  constructor(private readonly service: SupermarketService) {}

  /**
   * GET /api/supermarkets?page=1&pageSize=10&keyword=端氏 —— 分页列表
   * keyword 搜 name / 备注
   */
  @Get()
  @ApiOperation({ summary: '获取超市分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配超市名/备注（模糊、不区分大小写）', '端氏'))
  @ApiOkResponse({ description: '超市分页列表', schema: pagedOkBody(supermarketItemSchema, '超市对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /** GET /api/supermarkets/:id —— 单个超市；不存在 404 NOT_FOUND */
  @Get(':id')
  @ApiOperation({ summary: '获取单个超市' })
  @ApiParam(idParam('id', '超市 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个超市', schema: okBody(supermarketItemSchema) })
  @ApiResponse({ status: 404, description: '超市不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/supermarkets —— 创建超市
   * body：{ name, description? }
   * name 重复 → 409 SUPERMARKET_EXISTS
   */
  @Post()
  @ApiOperation({ summary: '创建超市' })
  @ApiBody({ description: '超市信息（超市名必填）', schema: supermarketCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新超市', schema: okBody(supermarketItemSchema) })
  @ApiResponse({ status: 409, description: '超市名称已存在', schema: errorBody('SUPERMARKET_EXISTS', '超市名称已存在') })
  @ApiResponse({ status: 422, description: '参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(supermarketSchema)) body: { name: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /** PATCH /api/supermarkets/:id —— 部分更新；name 撞重 409（排除自身） */
  @Patch(':id')
  @ApiOperation({ summary: '更新超市' })
  @ApiParam(idParam('id', '超市 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（只传需要修改的）', schema: supermarketCreateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后超市', schema: okBody(supermarketItemSchema) })
  @ApiResponse({ status: 404, description: '超市不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '超市名称已存在', schema: errorBody('SUPERMARKET_EXISTS', '超市名称已存在') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(supermarketSchema.partial())) body: { name?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /** DELETE /api/supermarkets/:id —— 删除（软删除，无引用检查） */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除超市（软删除）' })
  @ApiParam(idParam('id', '超市 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '超市不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
