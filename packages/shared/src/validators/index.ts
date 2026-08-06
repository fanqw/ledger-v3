import { z } from 'zod';

export const idSchema = z
  .string()
  .trim()
  .min(1, 'ID不能为空')
  .max(64, 'ID长度不能超过64')
  .regex(/^[A-Za-z0-9_-]+$/, 'ID格式不合法');

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100, '关键词长度不能超过100').optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100, '名称长度不能超过100'),
  description: z.string().trim().max(500, '描述长度不能超过500').optional(),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100, '名称长度不能超过100'),
  description: z.string().trim().max(500, '描述长度不能超过500').optional(),
});

export const commoditySchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100, '名称长度不能超过100'),
  categoryId: idSchema,
  unitId: idSchema,
  description: z.string().trim().max(500, '描述长度不能超过500').optional(),
});

export const purchasePlaceSchema = z.object({
  place: z.string().trim().min(1, '进货地不能为空').max(100, '进货地长度不能超过100'),
  marketName: z.string().trim().min(1, '市场名称不能为空').max(100, '市场名称长度不能超过100'),
  description: z.string().trim().max(500, '描述长度不能超过500').optional(),
});

export const orderCreateSchema = z.object({
  name: z.string().trim().min(1, '订单名称不能为空').max(100, '名称长度不能超过100'),
  // null 表示「清空进货地」（update 时），与「不修改」的 undefined 区分
  purchasePlaceId: z.union([idSchema, z.null()]).optional(),
  description: z.string().trim().max(500, '描述长度不能超过500').optional(),
});

export const orderUpdateSchema = orderCreateSchema.partial();

export const orderItemCreateSchema = z
  .object({
    commodityId: idSchema.optional(),
    commodityName: z.string().trim().min(1, '商品名称不能为空').max(100, '商品名称长度不能超过100').optional(),
    categoryId: idSchema.optional(),
    categoryName: z.string().trim().min(1, '分类名称不能为空').max(100, '分类名称长度不能超过100').optional(),
    unitId: idSchema.optional(),
    unitName: z.string().trim().min(1, '单位名称不能为空').max(100, '单位名称长度不能超过100').optional(),
    quantity: z.number().positive('数量必须大于0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
    lineTotal: z.number().nonnegative('金额不能为负'),
    description: z.string().trim().max(500, '描述长度不能超过500').optional(),
  })
  .refine(
    (data) => {
      const hasCommodityId = !!data.commodityId;
      const hasCommodityName = !!data.commodityName;
      return hasCommodityId || hasCommodityName;
    },
    { message: '必须提供 commodityId 或 commodityName（即输即建）', path: ['commodityId'] },
  )
  // m3: 引用已有商品与即输即建互斥，避免静默忽略一方
  .refine(
    (data) => !(data.commodityId && data.commodityName),
    { message: 'commodityId 与 commodityName 不能同时提供', path: ['commodityId'] },
  );

export const orderItemUpdateSchema = z
  .object({
    quantity: z.number().positive('数量必须大于0').optional(),
    unitPrice: z.number().nonnegative('单价不能为负').optional(),
    lineTotal: z.number().nonnegative('金额不能为负').optional(),
    description: z.string().trim().max(500, '描述长度不能超过500').optional(),
  })
  // m2: 至少提供一个字段，避免空 body 触发无意义更新
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: '至少提供一个要更新的字段', path: ['quantity'] },
  );

// 向后兼容别名
export const orderSchema = z.object({
  name: z.string().trim().min(1, '订单名称不能为空'),
  purchasePlaceId: z.string().optional(),
  description: z.string().trim().optional(),
});

export const orderItemSchema = z.object({
  commodityId: z.string().optional(),
  commodityName: z.string().trim().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().trim().optional(),
  unitId: z.string().optional(),
  unitName: z.string().trim().optional(),
  quantity: z.number().positive('数量必须大于0'),
  unitPrice: z.number().nonnegative('单价不能为负'),
  lineTotal: z.number().nonnegative('金额不能为负').optional(),
  description: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type IdInput = z.infer<typeof idSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type CommodityInput = z.infer<typeof commoditySchema>;
export type PurchasePlaceInput = z.infer<typeof purchasePlaceSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OrderItemCreateInput = z.infer<typeof orderItemCreateSchema>;
export type OrderItemUpdateInput = z.infer<typeof orderItemUpdateSchema>;
// 向后兼容别名
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
