import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { analyticsQuerySchema } from '@ledger-v3/shared/validators';
import type { AnalyticsWorkbenchResponse } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { errorBody } from '../../common/swagger-schemas';

/** Swagger 文档：商品排行条目（Top10 用） */
const commodityRankSchema = {
  type: 'object',
  properties: {
    commodityId: { type: 'string', description: '商品 ID', example: '507f1f77bcf86cd799439011' },
    name: { type: 'string', description: '商品名', example: '西红柿' },
    unit: { type: 'string', description: '单位名', example: '千克' },
    amount: { type: 'number', description: '金额（元）', example: 85000 },
    quantity: { type: 'number', description: '数量', example: 15000 },
  },
};

/** Swagger 文档：工作台聚合响应（6 块数据） */
const workbenchOkBody = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        kpis: {
          type: 'object',
          description: 'KPI 指标×4',
          properties: {
            totalAmount: { type: 'number', description: '总销售额（元）', example: 9886228.64 },
            orderCount: { type: 'integer', description: '订单数', example: 971 },
            commodityCount: { type: 'integer', description: '涉及商品种数', example: 721 },
            avgOrderAmount: { type: 'number', description: '客单价（元/单）', example: 10181.5 },
          },
        },
        dailyTrend: {
          type: 'array',
          description: '每日趋势（Top8 订单堆叠）',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: '日期', example: '2026-08-27' },
              total: { type: 'number', description: '当天总销售额（元）', example: 128500.5 },
              slotAmounts: { type: 'array', description: 'Top8 订单金额（不足补 0）', items: { type: 'number' } },
              otherAmount: { type: 'number', description: 'Top8 之外的金额汇总', example: 3200 },
              otherCount: { type: 'integer', description: 'Top8 之外的订单数', example: 5 },
              orders: { type: 'array', description: 'Top8 订单摘要（id/name/amount）', items: { type: 'object' } },
            },
          },
        },
        topCommodities: {
          type: 'object',
          description: '热购 Top10（两个维度）',
          properties: {
            byAmount: { type: 'array', description: '按金额 Top10', items: commodityRankSchema },
            byQuantity: { type: 'array', description: '按数量 Top10', items: commodityRankSchema },
          },
        },
        categoryShare: {
          type: 'array',
          description: '分类销售占比（金额降序）',
          items: {
            type: 'object',
            properties: {
              categoryId: { type: 'string', description: '分类 ID', example: '507f1f77bcf86cd799439011' },
              name: { type: 'string', description: '分类名（无分类显示"未分类"）', example: '蔬菜' },
              amount: { type: 'number', description: '金额（元）', example: 3200000 },
              percentage: { type: 'number', description: '占比（%，1 位小数）', example: 32.4 },
              commodityCount: { type: 'integer', description: '覆盖商品种数', example: 120 },
              orderCount: { type: 'integer', description: '覆盖订单数', example: 300 },
            },
          },
        },
        purchasePlaceShare: {
          type: 'array',
          description: '进货地销售占比（金额降序，未指定压底）',
          items: {
            type: 'object',
            properties: {
              purchasePlaceId: { type: 'string', nullable: true, description: '进货地 ID（null=未指定）', example: '507f1f77bcf86cd799439011' },
              name: { type: 'string', description: '进货地名（地点-市场名）', example: '中关村-中发电子批发市场' },
              amount: { type: 'number', description: '金额（元）', example: 1800000 },
              percentage: { type: 'number', description: '占比（%，1 位小数）', example: 18.2 },
              orderCount: { type: 'integer', description: '覆盖订单数', example: 150 },
            },
          },
        },
        orderSizeDistribution: {
          type: 'array',
          description: '订单规模分布（按金额分桶）',
          items: {
            type: 'object',
            properties: {
              bucket: { type: 'string', description: '金额区间', enum: ['0-1k', '1k-5k', '5k-10k', '10k-50k', '50k+'] },
              count: { type: 'integer', description: '该区间订单数', example: 42 },
            },
          },
        },
      },
    },
  },
};

/**
 * ==================== AnalyticsController（数据分析模块）====================
 *
 * 职责：数据分析工作台的聚合数据接口——把订单数据按 KPI/趋势/排行/占比/分布
 * 汇总成前端 ECharts 图表所需的结构。
 *
 * 学习点：
 * - 本模块只有只读接口（@Get），没有 CRUD——它是对已有订单数据的「读 + 聚合」
 * - 聚合逻辑全部在 service 的纯函数里做（输入订单数组 → 输出图表数据），
 *   不依赖数据库聚合函数，方便单元测试
 * - @ApiQuery 描述可选查询参数（Swagger 文档用）
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  /**
   * GET /api/analytics/workbench?start=2026-07-01&end=2026-08-01
   * 数据分析工作台聚合数据
   *
   * 入参：start/end 可选（YYYY-MM-DD）。语义 = [start, end] 闭区间（含首尾当天）
   * 缺省行为（后端兜底）：
   *   - end 缺省 → 今天
   *   - start 缺省 → end 往前 30 天
   *   （前端会按日历月自己算好范围再传；这里是兜底，防止无参调用返回空）
   *
   * 返回结构（AnalyticsWorkbenchResponse）：
   *   { kpis, dailyTrend, topCommodities, categoryShare,
   *     purchasePlaceShare, orderSizeDistribution }
   *   分别对应前端 4 个 KPI 卡片 + 每日趋势堆叠图 + 热购 Top10 +
   *   分类/进货地占比环形图 + 订单规模分布
   */
  @Get('workbench')
  @ApiOperation({ summary: '获取数据分析工作台聚合数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'end', required: false, description: '结束日期 YYYY-MM-DD' })
  @ApiOkResponse({ description: '工作台聚合数据（KPI/每日趋势/热购Top10/分类与进货地占比/规模分布）', schema: workbenchOkBody })
  @ApiResponse({ status: 422, description: '日期格式非法', schema: errorBody('VALIDATION_ERROR', '请求参数不合法') })
  async getWorkbench(
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: { start?: string; end?: string },
  ): Promise<{ success: boolean; data: AnalyticsWorkbenchResponse }> {
    // 缺省默认近 1 个月（日历月回退由前端处理；后端兜底近 30 天）
    const end = query.end || this.formatDate(new Date());
    const start = query.start || this.subDays(end, 30);
    const data = await this.service.getWorkbench(start, end);
    return { success: true, data };
  }

  /** Date → 'YYYY-MM-DD'（本地时区） */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 日期字符串减 N 天 → 'YYYY-MM-DD'（按 +08:00 时区解析，避免 UTC 偏移误差） */
  private subDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00+08:00`);
    d.setDate(d.getDate() - days);
    return this.formatDate(d);
  }
}
