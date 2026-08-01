import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnitService } from './unit.service';
import { unitSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitController {
  constructor(private readonly service: UnitService) {}

  @Get()
  @ApiOperation({ summary: '获取单位分页列表' })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个单位' })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: '创建单位' })
  async create(@Body(new ZodValidationPipe(unitSchema)) body: { name: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新单位' })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(unitSchema.partial())) body: { name?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除单位（软删除）' })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
