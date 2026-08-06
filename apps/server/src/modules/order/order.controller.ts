import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Get('next-name')
  @ApiOperation({ summary: '获取默认订单名称（YYYYMMDD-序号）' })
  async nextName() {
    const data = await this.service.getNextName();
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: '获取订单分页列表' })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取订单详情（含明细）' })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: '创建订单' })
  async create(@Body(new ZodValidationPipe(orderCreateSchema)) body: OrderCreateInput) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新订单' })
  async update(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(orderUpdateSchema)) body: OrderUpdateInput,
  ) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除订单（软删除）' })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }

  // ==================== Order Items ====================

  @Post(':orderId/items')
  @ApiOperation({ summary: '添加订单明细' })
  async addItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Body(new ZodValidationPipe(orderItemCreateSchema)) body: OrderItemCreateInput,
  ) {
    const data = await this.service.addItem(orderId, body);
    return { success: true, data };
  }

  @Patch(':orderId/items/:itemId')
  @ApiOperation({ summary: '更新订单明细' })
  async updateItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Param('itemId', new ZodValidationPipe(idSchema)) itemId: string,
    @Body(new ZodValidationPipe(orderItemUpdateSchema)) body: OrderItemUpdateInput,
  ) {
    const data = await this.service.updateItem(orderId, itemId, body);
    return { success: true, data };
  }

  @Delete(':orderId/items/:itemId')
  @HttpCode(200)
  @ApiOperation({ summary: '删除订单明细（软删除）' })
  async deleteItem(
    @Param('orderId', new ZodValidationPipe(idSchema)) orderId: string,
    @Param('itemId', new ZodValidationPipe(idSchema)) itemId: string,
  ) {
    return this.service.deleteItem(orderId, itemId);
  }
}
