export interface LoginDto {
  username: string;
  password: string;
}

export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitDto {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommodityDto {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  unitId: string;
  unitName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasePlaceDto {
  id: string;
  place: string;
  marketName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDto {
  id: string;
  name: string;
  description?: string;
  purchasePlaceId?: string;
  purchasePlace?: PurchasePlaceDto;
  items?: OrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  commodityId: string;
  commodityName?: string;
  categoryName?: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KpiDto {
  totalAmount: number;
  orderCount: number;
  commodityKindCount: number;
  monthlyOrderCount: number;
}

export interface DailyTrendDto {
  date: string;
  totalAmount: number;
  orders: { orderName: string; amount: number }[];
}

export interface CategoryDonutDto {
  categoryName: string;
  amount: number;
  percentage: number;
  commodityCount: number;
  orderCount: number;
}

export interface PurchasePlaceDonutDto {
  purchasePlaceName: string;
  amount: number;
  percentage: number;
  orderCount: number;
}

export interface HotProductDto {
  commodityName: string;
  quantity: number;
  amount: number;
}

export interface OrderDistributionDto {
  range: string;
  count: number;
}

export interface SessionDto {
  id: string;
  username: string;
  role: string;
}
