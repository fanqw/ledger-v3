import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiOkResponse, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnitService } from './unit.service';
import { unitSchema, idSchema, paginationSchema } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  pageQuery, pageSizeQuery, keywordQuery, idParam, okBody, pagedOkBody, okNullBody, errorBody,
} from '../../common/swagger-schemas';

/** Swagger 文档：单位对象结构（响应 items 用） */
const unitItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '单位 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '单位名称', example: '千克' },
    description: { type: 'string', nullable: true, description: '备注说明', example: '质量单位' },
    createdAt: { type: 'string', description: '创建时间（ISO）', example: '2026-08-01T08:00:00.000Z' },
    updatedAt: { type: 'string', description: '更新时间（ISO）', example: '2026-08-27T08:00:00.000Z' },
    deletedAt: { type: 'string', nullable: true, description: '软删除时间（未删除为 null）', example: null },
  },
};

/** Swagger 文档：创建单位请求体（name 必填） */
const unitCreateBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '单位名称（必填，自动去除首尾空格）', example: '千克', maxLength: 100 },
    description: { type: 'string', description: '备注说明（可选）', example: '质量单位', maxLength: 500 },
  },
};

/** Swagger 文档：更新单位请求体（全部可选） */
const unitUpdateBodySchema = {
  type: 'object',
  required: [],
  properties: unitCreateBodySchema.properties,
};

/**
 * ==================== UnitController（单位模块）====================
 *
 * 职责：计量单位基础资料 CRUD。结构与 CategoryController 完全相同（同模板），
 * 学习可对照 category.controller.ts 的完整讲解；这里只标注差异点：
 *
 * - 路由前缀 /units → 端点 /api/units
 * - body 用 unitSchema 校验；错误码用 UNIT_EXISTS / UNIT_IN_USE
 * - 被商品引用（unitId）的单位禁止删除
 *
 * 通用约定速览（详见 category.controller.ts）：
 * @ApiTags / @ApiBearerAuth / @UseGuards(JwtAuthGuard) 三件套 + @Controller 前缀
 * 每个入参过 ZodValidationPipe；controller 只负责 校验→调 service→包装 success 响应
 */
@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitController {
  constructor(private readonly service: UnitService) {}

  /**
   * GET /api/units?page=1&pageSize=10&keyword=千克 —— 单位分页列表
   * keyword 按 名称/备注 模糊搜索；返回 { success, data: { items, meta } }
   */
  @Get()
  @ApiOperation({ summary: '获取单位分页列表' })
  @ApiQuery(pageQuery)
  @ApiQuery(pageSizeQuery)
  @ApiQuery(keywordQuery('搜索关键词：匹配单位名称或备注（模糊、不区分大小写）', '千克'))
  @ApiOkResponse({ description: '单位分页列表', schema: pagedOkBody(unitItemSchema, '单位对象数组') })
  async findAll(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; pageSize: number; keyword?: string }) {
    const data = await this.service.findAll(query.page, query.pageSize, query.keyword);
    return { success: true, data };
  }

  /** GET /api/units/:id —— 单个单位（不存在 404 NOT_FOUND） */
  @Get(':id')
  @ApiOperation({ summary: '获取单个单位' })
  @ApiParam(idParam('id', '单位 ID（24 位 hex）'))
  @ApiOkResponse({ description: '单个单位', schema: okBody(unitItemSchema) })
  @ApiResponse({ status: 404, description: '单位不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  async findOne(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  /** POST /api/units —— 创建单位 { name, description? }；名称重复 409 UNIT_EXISTS */
  @Post()
  @ApiOperation({ summary: '创建单位' })
  @ApiBody({ description: '单位信息', schema: unitCreateBodySchema })
  @ApiOkResponse({ description: '创建成功，返回新单位', schema: okBody(unitItemSchema) })
  @ApiResponse({ status: 409, description: '单位名称已存在', schema: errorBody('UNIT_EXISTS', '单位名称已存在') })
  @ApiResponse({ status: 422, description: '参数校验失败', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async create(@Body(new ZodValidationPipe(unitSchema)) body: { name: string; description?: string }) {
    const data = await this.service.create(body);
    return { success: true, data };
  }

  /** PATCH /api/units/:id —— 部分更新；改名撞重 409（排除自身） */
  @Patch(':id')
  @ApiOperation({ summary: '更新单位' })
  @ApiParam(idParam('id', '单位 ID（24 位 hex）'))
  @ApiBody({ description: '要更新的字段（只传需要修改的）', schema: unitUpdateBodySchema })
  @ApiOkResponse({ description: '更新成功，返回更新后单位', schema: okBody(unitItemSchema) })
  @ApiResponse({ status: 404, description: '单位不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '单位名称已存在', schema: errorBody('UNIT_EXISTS', '单位名称已存在') })
  async update(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(unitSchema.partial())) body: { name?: string; description?: string }) {
    const data = await this.service.update(id, body);
    return { success: true, data };
  }

  /**
   * DELETE /api/units/:id —— 删除单位（软删除）
   * @HttpCode(200) 让 DELETE 也能返回 body；被商品引用 → 409 UNIT_IN_USE
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除单位（软删除）' })
  @ApiParam(idParam('id', '单位 ID（24 位 hex）'))
  @ApiOkResponse({ description: '删除成功', schema: okNullBody })
  @ApiResponse({ status: 404, description: '单位不存在', schema: errorBody('NOT_FOUND', '资源不存在') })
  @ApiResponse({ status: 409, description: '被商品引用，无法删除', schema: errorBody('UNIT_IN_USE', '该单位已被商品引用，无法删除') })
  async delete(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.service.delete(id);
  }
}
