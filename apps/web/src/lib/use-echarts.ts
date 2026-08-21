import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, PieSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  DataZoomComponentOption,
  TitleComponentOption,
} from 'echarts/components';

// 按需注册（控制 chunk 体积）
echarts.use([
  BarChart,
  PieChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent,
  CanvasRenderer,
]);

export type EChartsOption = ComposeOption<
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | TitleComponentOption
>;

/**
 * 基础 ECharts 渲染 hook（社区标准模式）。
 *
 * 调用方必须保证：
 * 1. 容器 div 通过 ref 常驻渲染（不因 loading 条件 return null）
 * 2. option 为 null 时图表清空（可选）
 *
 * 内部：容器挂载后 init，option 变化时 setOption，卸载时 dispose。
 * init 与 setOption 都在 effect 中执行，与 React 生命周期对齐。
 */
export function useECharts(option: EChartsOption | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 初始化（容器常驻，仅首次挂载执行）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // option 更新
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (option) {
      chart.setOption(option, { notMerge: true });
    } else {
      chart.clear();
    }
  }, [option]);

  return containerRef;
}

export default useECharts;
