import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/api';
import { toast } from '../lib/toast';
import { Button } from '../components/ui/button';
import useECharts, { type EChartsOption } from '../lib/use-echarts';
import type {
  AnalyticsWorkbenchResponse,
  AnalyticsDailyTrendItem,
  AnalyticsTopCommodities,
  AnalyticsCategoryShare,
  AnalyticsPurchasePlaceShare,
  AnalyticsOrderSizeBucket,
} from '@ledger-v3/shared/validators';

// ==================== 时间范围 ====================

interface RangeOption {
  label: string;
  months: number | null; // null = 自定义
}

const RANGE_OPTIONS: RangeOption[] = [
  { label: '近1个月', months: 1 },
  { label: '近3个月', months: 3 },
  { label: '近6个月', months: 6 },
  { label: '近12个月', months: 12 },
  { label: '自定义', months: null },
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 按日历月回退：近 N 个月 = start 为当月首日回退 N-1 个月，end 为当日 */
function calcRange(months: number): { start: string; end: string } {
  const today = new Date();
  const end = formatDate(today);
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
  return { start: formatDate(start), end };
}

const fmtAmount = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '0.00');

// ==================== 图表封装 ====================

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading: boolean }) {
  return (
    <div className="rounded-md border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]">
      <h3 className="mb-2 text-[14px] font-semibold text-[#0F172A] dark:text-white">{title}</h3>
      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-[13px] text-[#94A3B8]">加载中...</div>
      ) : (
        children
      )}
    </div>
  );
}

function EmptyChart({ height = 260 }: { height?: number }) {
  return (
    <div className={`flex items-center justify-center text-[13px] text-[#94A3B8]`} style={{ height }}>
      暂无数据
    </div>
  );
}

// 每日趋势：固定 9 series（slot1-8 + other）
function DailyTrendChart({ data, loading }: { data: AnalyticsDailyTrendItem[]; loading: boolean }) {
  const option: EChartsOption | null = data.length === 0 ? null : (() => {
    const dates = data.map((d) => d.date);
    // 堆叠块内部显示金额标签
    const blockLabel = { show: true, position: 'inside' as const, fontSize: 10, color: '#fff' };
    const slotSeries = Array.from({ length: 8 }, (_, i) => ({
      name: `${i + 1}`,
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 56,
      emphasis: { focus: 'series' as const },
      label: blockLabel,
      data: data.map((d) => d.slotAmounts[i] ?? 0),
    }));
    const otherSeries = {
      name: '其他',
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 56,
      emphasis: { focus: 'series' as const },
      label: blockLabel,
      data: data.map((d) => d.otherAmount),
    };
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex ?? 0;
          const day = data[idx];
          if (!day) return '';
          const lines = [`<b>${day.date}</b>`];
          day.orders.forEach((o, i) => {
            lines.push(`${i + 1}. ${o.name}: ¥${fmtAmount(o.amount)}`);
          });
          if (day.otherCount > 0) {
            lines.push(`其他 ${day.otherCount} 笔: ¥${fmtAmount(day.otherAmount)}`);
          }
          lines.push(`<b>合计: ¥${fmtAmount(day.total)}</b>`);
          return lines.join('<br/>');
        },
      },
      grid: { left: 50, right: 16, top: 32, bottom: 60 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${v}` } },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 18, bottom: 8 },
      ],
      series: [...slotSeries, otherSeries],
    } satisfies EChartsOption;
  })();
  const containerRef = useECharts(option);

  // 容器常驻渲染，loading/empty 用覆盖层
  return (
    <div className="relative h-[260px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {data.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#94A3B8]">暂无数据</div>
      )}
    </div>
  );
}

// 热购排行 Top10（金额/数量双 Tab）
function TopCommoditiesCard({ data, loading }: { data: AnalyticsTopCommodities; loading: boolean }) {
  const [tab, setTab] = useState<'amount' | 'quantity'>('amount');
  const list = tab === 'amount' ? data.byAmount : data.byQuantity;

  if (loading) return null;
  if (list.length === 0) return <EmptyChart height={200} />;

  const max = Math.max(...list.map((c) => (tab === 'amount' ? c.amount : c.quantity)), 0.0001);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Button variant={tab === 'amount' ? 'default' : 'outline'} size="default" className="h-8 px-3 text-[12px]" onClick={() => setTab('amount')}>金额排行</Button>
        <Button variant={tab === 'quantity' ? 'default' : 'outline'} size="default" className="h-8 px-3 text-[12px]" onClick={() => setTab('quantity')}>数量排行</Button>
      </div>
      <div className="space-y-1.5">
        {list.map((c, i) => {
          const val = tab === 'amount' ? c.amount : c.quantity;
          const pct = (val / max) * 100;
          // 前三名样式：奖牌色 + 加粗
          const medalCls = i === 0
            ? 'bg-yellow-400 text-yellow-900'
            : i === 1
              ? 'bg-slate-300 text-slate-800'
              : i === 2
                ? 'bg-amber-700 text-amber-50'
                : 'bg-[#E2E8F0] text-[#64748B]';
          const valueText = tab === 'amount'
            ? `¥${fmtAmount(c.amount)}`
            : `${c.quantity}${c.unit || ''}`;
          return (
            <div key={c.commodityId} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${medalCls}`}>{i + 1}</span>
              <span className={`w-32 truncate text-[12px] ${i < 3 ? 'font-semibold' : ''} text-[#0F172A] dark:text-white`}>{c.name}</span>
              <div className="h-3 flex-1 rounded bg-[#E2E8F0] dark:bg-[#334155]">
                <div className={`h-3 rounded ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`w-20 text-right text-[12px] ${i < 3 ? 'font-bold' : 'font-medium'} text-[#0F172A] dark:text-white`}>
                {valueText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 环形图（分类/进货地占比）
function DonutChart({ title, data, loading, centerLabel }: {
  title: string;
  data: { name: string; value: number }[];
  loading: boolean;
  centerLabel: string;
}) {
  const option: EChartsOption | null = data.length === 0 ? null : (() => {
    const total = data.reduce((s, d) => s + d.value, 0);
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const pct = ((params.value / (total || 1)) * 100).toFixed(1);
          return `${params.name}: ¥${fmtAmount(params.value)} (${pct}%)`;
        },
      },
      title: {
        text: `¥${fmtAmount(total)}`,
        subtext: centerLabel,
        left: 'center',
        top: '38%',
        textStyle: { fontSize: 16, fontWeight: 'bold' },
        subtextStyle: { fontSize: 12, color: '#64748B' },
      },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    } satisfies EChartsOption;
  })();
  const containerRef = useECharts(option);

  // 容器常驻渲染，loading/empty 用覆盖层
  return (
    <div className="relative h-[260px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {data.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#94A3B8]">暂无数据</div>
      )}
    </div>
  );
}

// 订单规模分布直方图
function OrderSizeHistogram({ data, loading }: { data: AnalyticsOrderSizeBucket[]; loading: boolean }) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 16, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: data.map((b) => b.bucket), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'bar',
        data: data.map((b) => b.count),
        itemStyle: { color: '#3B82F6', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: 11 },
      },
    ],
  };
  const containerRef = useECharts(option);

  // 容器常驻渲染，loading/empty 用覆盖层
  return (
    <div className="relative h-[260px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {data.every((b) => b.count === 0) && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#94A3B8]">暂无数据</div>
      )}
    </div>
  );
}

// ==================== 主页面 ====================

export default function AnalyticsPage() {
  const [range, setRange] = useState<string>('近1个月');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<AnalyticsWorkbenchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // 计算 start/end
    let start: string;
    let end: string;
    const opt = RANGE_OPTIONS.find((r) => r.label === range);
    if (opt && opt.months !== null) {
      ({ start, end } = calcRange(opt.months));
    } else {
      if (!customStart || !customEnd) return; // 自定义未确认不发请求
      start = customStart;
      end = customEnd;
    }

    // 取消过期请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    try {
      const res = await authFetch(`/api/analytics/workbench?start=${start}&end=${end}`, { signal: controller.signal });
      const json = await res.json();
      if (json.success) setData(json.data);
      else { setError(true); toast.error(json.error?.message || '加载失败'); }
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // 过期请求忽略
      setError(true);
      toast.error('加载数据分析失败');
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, reloadKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const kpis = data?.kpis;
  const categoryData = (data?.categoryShare ?? []).map((c: AnalyticsCategoryShare) => ({ name: c.name, value: c.amount }));
  const placeData = (data?.purchasePlaceShare ?? []).map((p: AnalyticsPurchasePlaceShare) => ({ name: p.name, value: p.amount }));

  return (
    <div className="space-y-4">
      {/* 标题 + 时间范围 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">数据分析工作台</h1>
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                range === r.label
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#E2E8F0] text-[#334155] hover:bg-[#CBD5E1] dark:bg-[#334155] dark:text-[#E2E8F0]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义日期 */}
      {range === '自定义' && (
        <div className="flex items-center gap-2 text-[13px]">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-md border border-[#E2E8F0] px-2 py-1 dark:border-[#334155] dark:bg-[#1E293B] dark:text-white" />
          <span className="text-[#64748B]">至</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-md border border-[#E2E8F0] px-2 py-1 dark:border-[#334155] dark:bg-[#1E293B] dark:text-white" />
          <Button size="default" className="h-8 px-3 text-[12px]" onClick={() => setReloadKey((k) => k + 1)} disabled={!customStart || !customEnd}>确认</Button>
        </div>
      )}

      {/* 错误态 */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-600 dark:border-red-900 dark:bg-red-950">
          <span>数据加载失败</span>
          <Button size="default" className="h-8 px-3 text-[12px]" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>重试</Button>
        </div>
      )}

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '采购总金额（元）', value: kpis ? fmtAmount(kpis.totalAmount) : '--' },
          { label: '订单总数', value: kpis ? String(kpis.orderCount) : '--' },
          { label: '商品种类', value: kpis ? String(kpis.commodityCount) : '--' },
          { label: '平均订单金额', value: kpis ? fmtAmount(kpis.avgOrderAmount) : '--' },
        ].map((k) => (
          <div key={k.label} className="rounded-md border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]">
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">{k.label}</p>
            <p className="mt-1 text-[22px] font-bold text-[#0F172A] dark:text-white">{loading ? '...' : k.value}</p>
          </div>
        ))}
      </div>

      {/* 图表网格 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 每日趋势占整行 */}
        <div className="lg:col-span-2">
          <ChartCard title="每日采购趋势" loading={loading}>
            <DailyTrendChart data={data?.dailyTrend ?? []} loading={loading} />
          </ChartCard>
        </div>
        <ChartCard title="热购商品排行 Top10" loading={loading}>
          <TopCommoditiesCard data={data?.topCommodities ?? { byAmount: [], byQuantity: [] }} loading={loading} />
        </ChartCard>
        <ChartCard title="分类金额占比" loading={loading}>
          <DonutChart title="分类" data={categoryData} loading={loading} centerLabel="总金额" />
        </ChartCard>
        <ChartCard title="进货地金额占比" loading={loading}>
          <DonutChart title="进货地" data={placeData} loading={loading} centerLabel="总金额" />
        </ChartCard>
        <ChartCard title="订单规模分布" loading={loading}>
          <OrderSizeHistogram data={data?.orderSizeDistribution ?? []} loading={loading} />
        </ChartCard>
      </div>
    </div>
  );
}
