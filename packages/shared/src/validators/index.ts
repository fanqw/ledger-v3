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
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
