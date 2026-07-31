import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PurchasePlaceService } from './purchase-place.service';
import { purchasePlaceSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@ApiTags('Purchase Places')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-places')
export class PurchasePlaceController {
  constructor(private readonly service: PurchasePlaceService) {}

  @Get()
  @ApiOperation({ summary: '获取进货地分页列表' })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个进货地' })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: '创建进货地' })
  async create(@Body(new ZodValidationPipe(purchasePlaceSchema)) body: { place: string; marketName: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新进货地' })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(purchasePlaceSchema.partial())) body: { place?: string; marketName?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除进货地（软删除）' })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
