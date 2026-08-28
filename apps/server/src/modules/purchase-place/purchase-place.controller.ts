import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PurchasePlaceService } from './purchase-place.service';
import { purchasePlaceSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：进货地对象结构（响应 items 用） */
const purchasePlaceItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '进货地 ID', example: '507f1f77bcf86cd799439011' },
    place: { type: 'string', description: '进货地（城市）', example: '晋城' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '老客户，可月结' },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建进货地请求体（place 必填） */
const purchasePlaceCreateBodySchema = {
  type: 'object',
  required: ['place'],
  properties: {
    place: { type: 'string', description: '进货地（城市，必填，自动去除首尾空格）', example: '晋城', maxLength: 100 },
    description: { type: 'string', description: '备注说明（可选）', example: '老客户，可月结', maxLength: 500 },
  },
};

/** Swagger 文档：更新进货地请求体（全部可选） */
const purchasePlaceUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: purchasePlaceCreateBodySchema.properties,
};

/**
 * ==================== PurchasePlaceController（进货地=城市模块）====================
 *
 * 职责：进货地（城市）基础资料 CRUD。与 category/unit 同模板：
 *
 * - 路由前缀 /purchase-places → 端点 /api/purchase-places
 * - 必填字段：{ place（城市名）}，描述可选
 * - 唯一性 = place（城市名）唯一
 * - 被「市场」引用（Market.cityId）时禁止删除 → PURCHASE_PLACE_IN_USE
 *
 * 通用模式（守卫 / ZodValidationPipe / 统一响应）见 category.controller.ts。
 */
@ApiTags('Purchase Places')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-places')
export class PurchasePlaceController {
  constructor(private readonly service: PurchasePlaceService) {}

  /**
   * GET /api/purchase-places?page=1&pageSize=10&keyword=晋城 —— 分页列表
   * keyword 搜 place（城市）/ 备注
   */
  @Get()
  @ApiOperation({ summary: '获取进货地分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配进货地/备注（模糊、不区分大小写）', '晋城'))
  @ApiOkResponse({ description: '进货地分页列表', schema: pagedOkBody(purchasePlaceItemSchema, '进货地对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /** GET /api/purchase-places/:id —— 单个进货地；不存在 404 NOT_FOUND */
  @Get(':id')
  @ApiOperation({ summary: '获取单个进货地' })
  @ApiParam(idParam('id', '进货地 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个进货地', schema: okBody(purchasePlaceItemSchema) })
  @ApiResponse({ status: 404, description: '进货地不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/purchase-places —— 创建进货地
   * body：{ place, description? }
   * place 重复 → 409 PURCHASE_PLACE_EXISTS
   */
  @Post()
  @ApiOperation({ summary: '创建进货地' })
  @ApiBody({ description: '进货地信息（城市必填）', schema: purchasePlaceCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新进货地', schema: okBody(purchasePlaceItemSchema) })
  @ApiResponse({ status: 409, description: '进货地已存在', schema: errorBody('PURCHASE_PLACE_EXISTS', '进货地已存在') })
  @ApiResponse({ status: 422, description: '参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(purchasePlaceSchema)) body: { place: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /** PATCH /api/purchase-places/:id —— 部分更新；place 撞重 409（排除自身） */
  @Patch(':id')
  @ApiOperation({ summary: '更新进货地' })
  @ApiParam(idParam('id', '进货地 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（只传需要修改的）', schema: purchasePlaceUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后进货地', schema: okBody(purchasePlaceItemSchema) })
  @ApiResponse({ status: 404, description: '进货地不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '进货地已存在', schema: errorBody('PURCHASE_PLACE_EXISTS', '进货地已存在') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(purchasePlaceSchema.partial())) body: { place?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /** DELETE /api/purchase-places/:id —— 删除（软删除）；被市场引用 → 409 PURCHASE_PLACE_IN_USE */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除进货地（软删除）' })
  @ApiParam(idParam('id', '进货地 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '进货地不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '被市场引用，无法删除', schema: errorBody('PURCHASE_PLACE_IN_USE', '该进货地已被市场引用，无法删除') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
