import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommodityService } from './commodity.service';
import { commoditySchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：分类/单位简要对象（商品内嵌用） */
const commodityRefSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '关联 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '名称', example: '蔬菜' },
  },
};

/** Swagger 文档：商品对象结构（响应 items 用，含联表的 category/unit） */
const commodityItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '商品 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '商品名称', example: '西红柿' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '沙瓤西红柿' },
    category: { type: 'object', description: '所属分类（联表查询）', properties: commodityRefSchema.properties },
    unit: { type: 'object', description: '计量单位（联表查询）', properties: commodityRefSchema.properties },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建商品请求体（name + categoryId + unitId 必填） */
const commodityCreateBodySchema = {
  type: 'object',
  required: ['name', 'categoryId', 'unitId'],
  properties: {
    name: { type: 'string', description: '商品名称（必填，自动去除首尾空格）', example: '西红柿', maxLength: 100 },
    categoryId: { type: 'string', description: '所属分类 ID（必填，需存在且未删除）', example: '507f1f77bcf86cd799439011' },
    unitId: { type: 'string', description: '计量单位 ID（必填，需存在且未删除）', example: '507f1f77bcf86cd799439011' },
    description: { type: 'string', description: '备注说明（可选）', example: '沙瓤西红柿', maxLength: 500 },
  },
};

/** Swagger 文档：更新商品请求体（全部可选） */
const commodityUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: commodityCreateBodySchema.properties,
};

/**
 * ==================== CommodityController（商品模块）====================
 *
 * 职责：商品基础资料 CRUD。与 category/unit 同模板，但商品是「关联实体」——
 * 它通过外键引用 Category（分类）和 Unit（单位），所以比简单 CRUD 多了外键处理。
 *
 * 学习重点（与简单 CRUD 的差异）：
 * 1. 入参多两个外键字段：{ name, categoryId, unitId }（过 commoditySchema 校验）
 * 2. 查询/返回都 include category + unit —— 「联表查询」，前端一次拿到关联对象
 *    （Prisma 用 include 展开关系，而不是手写 JOIN）
 * 3. 创建/更新时 service 会校验外键是否存在（防止 Prisma 外键约束抛 500）
 *
 * 其余通用模式（@UseGuards / ZodValidationPipe / 统一响应）见 category.controller.ts。
 */
@ApiTags('Commodities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commodities')
export class CommodityController {
  constructor(private readonly service: CommodityService) {}

  /**
   * GET /api/commodities?page=1&pageSize=10&keyword=苹果 —— 商品分页列表
   * keyword 同时搜 商品名/备注/分类名/单位名（service 的 where.OR）
   * 返回每条含 category + unit 联表对象
   */
  @Get()
  @ApiOperation({ summary: '获取商品分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配商品名/备注/分类名/单位名（模糊、不区分大小写）', '西红柿'))
  @ApiOkResponse({ description: '商品分页列表（每条含联表的分类/单位）', schema: pagedOkBody(commodityItemSchema, '商品对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /** GET /api/commodities/:id —— 单个商品（含分类/单位）；不存在 404 NOT_FOUND */
  @Get(':id')
  @ApiOperation({ summary: '获取单个商品' })
  @ApiParam(idParam('id', '商品 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个商品（含分类/单位）', schema: okBody(commodityItemSchema) })
  @ApiResponse({ status: 404, description: '商品不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/commodities —— 创建商品
   * 入参 body：{ name, categoryId, unitId, description? }
   * - 外键不存在 → 422 VALIDATION_ERROR（service 校验）
   * - 同名同单位重复 → 409 COMMODITY_EXISTS
   */
  @Post()
  @ApiOperation({ summary: '创建商品' })
  @ApiBody({ description: '商品信息（需指定分类/单位）', schema: commodityCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新商品（含分类/单位）', schema: okBody(commodityItemSchema) })
  @ApiResponse({ status: 409, description: '同名同单位商品已存在', schema: errorBody('COMMODITY_EXISTS', '商品名称已存在') })
  @ApiResponse({ status: 422, description: '分类/单位不存在，或参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(commoditySchema)) body: { name: string; description?: string; categoryId: string; unitId: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /**
   * PATCH /api/commodities/:id —— 更新商品（可改分类/单位）
   * 学习点：关系字段用 { connect: { id } } 连接（Prisma 的关系更新语法）
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新商品' })
  @ApiParam(idParam('id', '商品 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（可改分类/单位）', schema: commodityUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后商品', schema: okBody(commodityItemSchema) })
  @ApiResponse({ status: 404, description: '商品不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '同名同单位商品已存在', schema: errorBody('COMMODITY_EXISTS', '商品名称已存在') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(commoditySchema.partial())) body: { name?: string; description?: string; categoryId?: string; unitId?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /** DELETE /api/commodities/:id —— 删除商品（软删除）；被订单明细引用 → 409 COMMODITY_IN_USE */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除商品（软删除）' })
  @ApiParam(idParam('id', '商品 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '商品不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '被订单明细引用，无法删除', schema: errorBody('COMMODITY_IN_USE', '该商品已被订单引用，无法删除') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
