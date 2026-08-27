/**
 * ==================== Swagger Schema 复用片段 ====================
 *
 * 目的：让 /api/docs 页面展示完整的请求/响应结构（字段含义、类型、示例值）。
 *
 * 背景：NestJS Swagger 无法从 Zod schema 推断 OpenAPI 结构（项目校验走
 * shared 的 Zod，而非 class-validator DTO），所以这里手写 OpenAPI schema 片段，
 * 供各 controller 的 @ApiBody / @ApiResponse / @ApiQuery / @ApiParam 引用。
 *
 * 注意：以下内容仅用于生成文档，不参与运行时校验——
 * 运行时校验仍是 @ledger-v3/shared/validators 里的 Zod schema。
 */

// ==================== 通用查询参数（分页）====================

/** 分页：page（页码，从 1 开始） */
export const pageQuery = {
  name: 'page',
  required: true,
  description: '页码（从 1 开始）',
  schema: { type: 'integer', example: 1 },
};

/** 分页：pageSize（每页条数，1-100） */
export const pageSizeQuery = {
  name: 'pageSize',
  required: true,
  description: '每页条数（1-100）',
  schema: { type: 'integer', example: 10 },
};

/** 搜索关键词（可选）——具体匹配字段由各模块决定 */
export const keywordQuery = (description: string, example: string) => ({
  name: 'keyword',
  required: false,
  description,
  schema: { type: 'string', example },
});

// ==================== 路径参数 ====================

/** 路径参数：资源 id（24 位 hex，迁移数据为 MongoDB ObjectId） */
export const idParam = (name: string, description: string) => ({
  name,
  required: true,
  description,
  schema: { type: 'string', example: '507f1f77bcf86cd799439011' },
});

// ==================== 响应结构 ====================

/** 成功响应包装：{ success: true, data: <dataSchema> } */
export const okBody = (dataSchema: Record<string, unknown>): Record<string, unknown> => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', description: '是否成功', example: true },
    data: dataSchema,
  },
});

/** 分页列表成功响应：{ success, data: { items, meta: { page, pageSize, total } } } */
export const pagedOkBody = (
  itemSchema: Record<string, unknown>,
  itemDescription: string,
): Record<string, unknown> => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', description: '是否成功', example: true },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', description: itemDescription, items: itemSchema },
        meta: {
          type: 'object',
          description: '分页元信息',
          properties: {
            page: { type: 'integer', description: '当前页码', example: 1 },
            pageSize: { type: 'integer', description: '每页条数', example: 10 },
            total: { type: 'integer', description: '总记录数', example: 47 },
          },
        },
      },
    },
  },
});

/** 删除/无数据操作的统一成功响应：{ success: true, data: null } */
export const okNullBody: Record<string, unknown> = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'string', nullable: true, example: null },
  },
};

/** 失败响应包装：{ success: false, error: { code, message } } */
export const errorBody = (code: string, message: string): Record<string, unknown> => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '业务错误码', example: code },
        message: { type: 'string', description: '错误提示', example: message },
      },
    },
  },
});
