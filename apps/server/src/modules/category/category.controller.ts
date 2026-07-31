import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoryService } from './category.service';
import { categorySchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  @ApiOperation({ summary: '获取分类分页列表' })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个分类' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: '创建分类' })
  async create(@Body(new ZodValidationPipe(categorySchema)) body: { name: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新分类' })
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(categorySchema.partial())) body: { name?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除分类（软删除）' })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
