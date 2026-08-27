import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import {
  orderCreateSchema,
  orderUpdateSchema,
  orderItemCreateSchema,
  orderItemUpdateSchema,
  idSchema,
  paginationSchema,
} from '@ledger-v3/shared/validators';
import type {
  OrderCreateInput,
  OrderUpdateInput,
  OrderItemCreateInput,
  OrderItemUpdateInput,
  PaginationInput,
} from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：进货地简要对象（订单内嵌用） */
const orderPurchasePlaceSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '进货地 ID', example: '507f1f77bcf86cd799439011' },
    place: { type: 'string', description: '进货地点', example: '中关村' },
    marketName: { type: 'string', description: '市场名称', example: '中发电子批发市场' },
  },
};

/** Swagger 文档：商品简要对象（明细内嵌用，含分类/单位） */
const orderItemCommoditySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '商品 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '商品名称', example: '西红柿' },
    category: { type: 'object', description: '所属分类', properties: { id: { type: 'string' }, name: { type: 'string', example: '蔬菜' } } },
    unit: { type: 'object', description: '计量单位', properties: { id: { type: 'string' }, name: { type: 'string', example: '千克' } } },
  },
};

/** Swagger 文档：订单明细对象（含计算字段 computedLineTotal/isModified） */
const orderItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '明细 ID', example: '507f1f77bcf86cd799439011' },
    quantity: { type: 'number', description: '数量', example: 3 },
    unitPrice: { type: 'number', description: '单价', example: 5.5 },
    lineTotal: { type: 'number', description: '金额（存储值）', example: 16.5 },
    computedLineTotal: { type: 'number', description: '理论金额 = 数量×单价（round2）', example: 16.5 },
    isModified: { type: 'boolean', description: '金额是否被手动改过（与理论值偏差>0.005）', example: false },
    description: { type: 'string', nullable: true, description: '备注', example: '要沙瓤的' },
    commodity: { type: 'object', description: '关联商品（联表）', properties: orderItemCommoditySchema.properties },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：订单对象（列表用，不含明细，含进货地） */
const orderListSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '订单 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '订单名称', example: '20260827-01' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '临期促销订单' },
    purchasePlace: { type: 'object', nullable: true, description: '进货地（可空）', properties: orderPurchasePlaceSchema.properties },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：订单详情（含明细数组） */
const orderDetailSchema = {
  type: 'object',
  properties: {
    ...orderListSchema.properties,
    items: { type: 'array', description: '订单明细（按分类分组排序）', items: orderItemSchema },
  },
};

/** Swagger 文档：创建订单请求体（name 必填） */
const orderCreateBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '订单名称（必填，自动去除首尾空格）', example: '20260827-01', maxLength: 100 },
    description: { type: 'string', description: '备注说明（可选）', example: '临期促销订单', maxLength: 500 },
    purchasePlaceId: { type: 'string', nullable: true, description: '进货地 ID（可选，传 null 表示无进货地）', example: '507f1f77bcf86cd799439011' },
  },
};

/** Swagger 文档：更新订单请求体（全部可选） */
const orderUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: orderCreateBodySchema.properties,
};

/** Swagger 文档：添加明细请求体（路径 A 引用已有商品 / 路径 B 即输即建） */
const orderItemCreateBodySchema = {
  type: 'object',
  required: ['quantity', 'unitPrice'],
  properties: {
    commodityId: { type: 'string', description: '路径A：引用已有商品 ID（与路径B二选一）', example: '507f1f77bcf86cd799439011' },
    commodityName: { type: 'string', description: '路径B：新商品名称（即输即建，自动创建商品）', example: '西红柿', maxLength: 100 },
    categoryId: { type: 'string', description: '路径B：分类 ID（与 categoryName 二选一）', example: '507f1f77bcf86cd799439011' },
    categoryName: { type: 'string', description: '路径B：分类名称（不存在自动创建）', example: '蔬菜', maxLength: 100 },
    unitId: { type: 'string', description: '路径B：单位 ID（与 unitName 二选一）', example: '507f1f77bcf86cd799439011' },
    unitName: { type: 'string', description: '路径B：单位名称（不存在自动创建）', example: '千克', maxLength: 100 },
    quantity: { type: 'number', description: '数量（必须 >0）', example: 3 },
    unitPrice: { type: 'number', description: '单价（必须 ≥0）', example: 5.5 },
    lineTotal: { type: 'number', description: '金额（前端实时算 数量×单价，可手动改）', example: 16.5 },
    description: { type: 'string', description: '备注（可选）', example: '要沙瓤的', maxLength: 500 },
  },
};

/** Swagger 文档：更新明细请求体（全部可选） */
const orderItemUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: {
    quantity: { type: 'number', description: '数量', example: 5 },
    unitPrice: { type: 'number', description: '单价', example: 5.5 },
    lineTotal: { type: 'number', description: '金额（显式传则原样存；只改数量/单价则自动重算）', example: 27.5 },
    description: { type: 'string', description: '备注', example: '改备注', maxLength: 500 },
  },
};

/**
 * ==================== OrderController（订单模块）====================
 *
 * 职责：订单 + 订单明细（OrderItem）的 CRUD。这是全系统最复杂的模块，
 * 核心在于「订单」与「明细」是 1:N 嵌套结构。
 *
 * 嵌套资源路由（NestJS 嵌套路由的经典用法）：
 *   POST/PATCH/DELETE /orders/:orderId/items[/:itemId]
 *   —— 明细挂在订单之下，路径里带 orderId 表达「这个明细属于哪个订单」
 *
 * 学习重点（与基础资料 CRUD 的差异）：
 * 1. 订单的 body 校验拆成两个 Schema：
 *    - orderCreateSchema（创建：name 必填）
 *    - orderUpdateSchema（更新：全部可选，用 .partial()）
 *    明细同理：orderItemCreateSchema / orderItemUpdateSchema
 * 2. 明细的「即输即建」逻辑在 service（addItem）：可以引用已有商品，
 *    也可以直接填名称/分类/单位让后端现建商品 —— 这是本模块的灵魂
 * 3. 金额字段（quantity/unitPrice/lineTotal）后端用 Decimal 存储，
 *    service 返回前统一转 number 序列化（见 serializeOrderItem）
 *
 * 通用模式（守卫 / ZodValidationPipe / 统一响应）见 category.controller.ts。
 */
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  /**
   * GET /api/orders/next-name —— 获取默认订单名称
   * 用途：前端「新建订单」弹窗打开时预填名称，格式 YYYYMMDD-序号
   * 注意：@Get('next-name') 必须声明在 @Get(':id') 之前——
   *   NestJS 路由按声明顺序匹配，若 ':id' 在前会把 'next-name' 当成 id 匹配
   * 序号 = 当天已创建的订单数 + 1（见 service.getNextName）
   */
  @Get('next-name')
  @ApiOperation({ summary: '获取默认订单名称（YYYYMMDD-序号）' })
  @ApiOkResponse({ description: '建议订单名称', schema: okBody({ type: 'object', properties: { name: { type: 'string', description: '建议名称', example: '20260827-01' } } }) })
  async nextName() {
    const data = await this.service.getNextName();
    return { success: true, data };
  }

  /**
   * GET /api/orders?page=1&pageSize=10&keyword=客户 —— 订单分页列表
   * keyword 搜 订单名/备注/进货地(place/marketName)
   * 列表只带 purchasePlace 联表（不含 items，列表页不需要明细，避免大响应）
   */
  @Get()
  @ApiOperation({ summary: '获取订单分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配订单名/备注/进货地（地点或市场名）', '20260827'))
  @ApiOkResponse({ description: '订单分页列表（不含明细）', schema: pagedOkBody(orderListSchema, '订单对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /**
   * GET /api/orders/:id —— 订单详情（含全部明细）
   * 返回结构（service 组装）：
   *   订单字段 + items[]，每条明细含 commodity（再含 category + unit），
   *   以及 computedLineTotal / isModified 两个「计算字段」
   *   —— isModified=true 表示金额被手动改过（前端据此把金额标红）
   */
  @Get(':id')
  @ApiOperation({ summary: '获取订单详情（含明细）' })
  @ApiParam(idParam('id', '订单 ID（24 位 hex）'))
  @ApiOkResponse({ description: '订单详情（含明细，明细带 isModified 标红信息）', schema: okBody(orderDetailSchema) })
  @ApiResponse({ status: 404, description: '订单不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /**
   * POST /api/orders —— 创建订单
   * body：{ name, description?, purchasePlaceId? }
   * - 名称重复 → 409 ORDER_EXISTS
   * - 进货地不存在/已删除 → 422 VALIDATION_ERROR
   * - purchasePlaceId 可选（订单可以没有进货地）
   */
  @Post()
  @ApiOperation({ summary: '创建订单' })
  @ApiBody({ description: '订单信息', schema: orderCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新订单', schema: okBody(orderDetailSchema) })
  @ApiResponse({ status: 409, description: '订单名称已存在', schema: errorBody('ORDER_EXISTS', '订单名称已存在') })
  @ApiResponse({ status: 422, description: '进货地不存在，或参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(orderCreateSchema)) body: OrderCreateInput) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /**
   * PATCH /api/orders/:id —— 更新订单（部分更新）
   * 学习点：purchasePlaceId 传 null = 显式清空进货地（service 用 disconnect 断开关系）
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新订单' })
  @ApiParam(idParam('id', '订单 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（purchasePlaceId 传 null 可清空进货地）', schema: orderUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后订单', schema: okBody(orderDetailSchema) })
  @ApiResponse({ status: 404, description: '订单不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '订单名称已存在', schema: errorBody('ORDER_EXISTS', '订单名称已存在') })
  async update(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(orderUpdateSchema)) body: OrderUpdateInput,
  ) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /**
   * DELETE /api/orders/:id —— 删除订单（软删除）
   * 订单下还有未删除明细 → 409 ORDER_HAS_ITEMS（必须先删完明细）
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除订单（软删除）' })
  @ApiParam(idParam('id', '订单 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '订单不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '订单下还有未删除明细', schema: errorBody('ORDER_HAS_ITEMS', '订单下存在明细，请先删除所有明细') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }

  // ==================== Order Items（嵌套资源） ====================

  /**
   * POST /api/orders/:orderId/items —— 添加订单明细
   * body（orderItemCreateSchema）：两条路径二选一：
   *   路径 A「引用已有商品」：commodityId（订单里直接引用库里商品）
   *   路径 B「即输即建」：commodityName + categoryId/categoryName + unitId/unitName
   *     —— 商品不存在时后端自动新建（分类/单位也自动建），这是核心特性
   * 共同字段：quantity, unitPrice, lineTotal, description?
   * 错误：orderId 不存在 404；商品/分类/单位不存在 404 或 422
   */
  @Post(':orderId/items')
  @ApiOperation({ summary: '添加订单明细' })
  @ApiParam(idParam('orderId', '所属订单 ID（24 位 hex）'))
  @ApiBody({ description: '路径A(commodityId)引用已有商品；路径B(commodityName)即输即建', schema: orderItemCreateBodySchema })
  @ApiOkResponse({ description: '添加成功，返回新明细（含商品）', schema: okBody(orderItemSchema) })
  @ApiResponse({ status: 404, description: '订单/商品不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 422, description: '即输即建缺分类/单位，或参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async addItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Body(new ZodValidationPipe(orderItemCreateSchema)) body: OrderItemCreateInput,
  ) {
    const data = await this.service.addItem(orderId, body);
    return { success: true, data };
  }

  /**
   * PATCH /api/orders/:orderId/items/:itemId —— 更新明细
   * body（orderItemUpdateSchema）：quantity / unitPrice / lineTotal / description 任意可选
   * lineTotal 逻辑（见 service）：显式传则原样存；只改数量/单价则自动重算
   */
  @Patch(':orderId/items/:itemId')
  @ApiOperation({ summary: '更新订单明细' })
  @ApiParam(idParam('orderId', '所属订单 ID（24 位 hex）'))
  @ApiParam(idParam('itemId', '明细 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段', schema: orderItemUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后明细', schema: okBody(orderItemSchema) })
  @ApiResponse({ status: 404, description: '订单/明细不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async updateItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Param('itemId', new ZodValidationPipe(idSchema)) itemId: string,
    @Body(new ZodValidationPipe(orderItemUpdateSchema)) body: OrderItemUpdateInput,
  ) {
    const data = await this.service.updateItem(orderId, itemId, body);
    return { success: true, data };
  }

  /**
   * DELETE /api/orders/:orderId/items/:itemId —— 删除明细（软删除）
   * 只删除明细，不影响订单本身
   */
  @Delete(':orderId/items/:itemId')
  @HttpCode(200)
  @ApiOperation({ summary: '删除订单明细（软删除）' })
  @ApiParam(idParam('orderId', '所属订单 ID（24 位 hex）'))
  @ApiParam(idParam('itemId', '明细 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '订单/明细不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async deleteItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Param('itemId', new ZodValidationPipe(idSchema)) itemId: string,
  ) {
    return this.service.deleteItem(orderId, itemId);
  }
}
