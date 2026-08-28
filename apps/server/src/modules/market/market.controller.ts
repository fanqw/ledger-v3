import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketService } from './market.service';
import { marketSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：市场对象结构（含所属城市） */
const marketItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '市场 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '市场名称', example: '长治市场' },
    cityId: { type: 'string', description: '所属进货地（城市）ID', example: '507f1f77bcf86cd799439022' },
    city: {
      type: 'object',
      description: '所属城市',
      properties: {
        id: { type: 'string', description: '城市 ID' },
        place: { type: 'string', description: '城市名', example: '晋城' },
      },
    },
    description: { type: 'string', nullable: true, description: '备注说明', example: '主营蔬菜批发' },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建市场请求体（name + cityId 必填） */
const marketCreateBodySchema = {
  type: 'object',
  required: ['name', 'cityId'],
  properties: {
    name: { type: 'string', description: '市场名称（必填，自动去除首尾空格）', example: '长治市场', maxLength: 100 },
    cityId: { type: 'string', description: '所属进货地（城市）ID（必填）', example: '507f1f77bcf86cd799439022' },
    description: { type: 'string', description: '备注说明（可选）', example: '主营蔬菜批发', maxLength: 500 },
  },
};

/**
 * ==================== MarketController（市场模块）====================
 *
 * 职责：市场基础资料 CRUD（城市中的批发市场，关联进货地城市）。
 *
 * - 路由前缀 /markets → 端点 /api/markets
 * - 必填字段：{ name（市场名）, cityId（所属城市）}，描述可选
 * - 唯一性 = name（市场名）唯一
 * - 被「订单」引用（Order.marketId）时禁止删除 → MARKET_IN_USE
 *
 * 通用模式（守卫 / ZodValidationPipe / 统一响应）见 category.controller.ts。
 */
@ApiTags('Markets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('markets')
export class MarketController {
  constructor(private readonly service: MarketService) {}

  /**
   * GET /api/markets?page=1&pageSize=10&keyword=长治 —— 分页列表
   * keyword 搜 name / 所属城市 place / 备注
   */
  @Get()
  @ApiOperation({ summary: '获取市场分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配市场名/城市/备注（模糊、不区分大小写）', '长治'))
  @ApiOkResponse({ description: '市场分页列表', schema: pagedOkBody(marketItemSchema, '市场对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /** GET /api/markets/:id —— 单个市场；不存在 404 NOT_FOUND */
  @Get(':id')
  @ApiOperation({ summary: '获取单个市场' })
  @ApiParam(idParam('id', '市场 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个市场', schema: okBody(marketItemSchema) })
  @ApiResponse({ status: 404, description: '市场不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/markets —— 创建市场
   * body：{ name, cityId, description? }
   * 城市不存在 → 422；name 重复 → 409 MARKET_EXISTS
   */
  @Post()
  @ApiOperation({ summary: '创建市场' })
  @ApiBody({ description: '市场信息（市场名+所属城市必填）', schema: marketCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新市场', schema: okBody(marketItemSchema) })
  @ApiResponse({ status: 409, description: '市场名称已存在', schema: errorBody('MARKET_EXISTS', '市场名称已存在') })
  @ApiResponse({ status: 422, description: '城市不存在或参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(marketSchema)) body: { name: string; cityId: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /** PATCH /api/markets/:id —— 部分更新；name 撞重 409（排除自身） */
  @Patch(':id')
  @ApiOperation({ summary: '更新市场' })
  @ApiParam(idParam('id', '市场 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（只传需要修改的）', schema: marketCreateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后市场', schema: okBody(marketItemSchema) })
  @ApiResponse({ status: 404, description: '市场不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '市场名称已存在', schema: errorBody('MARKET_EXISTS', '市场名称已存在') })
  @ApiResponse({ status: 422, description: '城市不存在', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(marketSchema.partial())) body: { name?: string; cityId?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /** DELETE /api/markets/:id —— 删除（软删除）；被订单引用 → 409 MARKET_IN_USE */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除市场（软删除）' })
  @ApiParam(idParam('id', '市场 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '市场不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '被订单引用，无法删除', schema: errorBody('MARKET_IN_USE', '该市场已被订单引用，无法删除') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
