import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { analyticsQuerySchema } from '@ledger-v3/shared/validators';
import type { AnalyticsWorkbenchResponse } from '@ledger-v3/shared/validators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('workbench')
  @ApiOperation({ summary: '获取数据分析工作台聚合数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始日期 YYYY-MM-DD' })
  @ApiQuery({ name: 'end', required: false, description: '结束日期 YYYY-MM-DD' })
  async getWorkbench(
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: { start?: string; end?: string },
  ): Promise<{ success: boolean; data: AnalyticsWorkbenchResponse }> {
    // 缺省默认近 1 个月（日历月回退由前端处理；后端兜底近 30 天）
    const end = query.end || this.formatDate(new Date());
    const start = query.start || this.subDays(end, 30);
    const data = await this.service.getWorkbench(start, end);
    return { success: true, data };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private subDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00+08:00`);
    d.setDate(d.getDate() - days);
    return this.formatDate(d);
  }
}
