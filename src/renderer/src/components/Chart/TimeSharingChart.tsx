import { memo, useEffect, useState, useRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { VChart } from '@visactor/react-vchart';
import type { ICommonChartSpec, ICartesianAxisSpec } from '@visactor/vchart';
import { useTheme } from 'next-themes';
import { useSize, useDebounceFn } from 'ahooks';
import { PriceAndVolumeItem, PeriodType } from '@shared/types/stock';
import { RED_COLOR, GREEN_COLOR } from '@/lib/constants';
import { computeMACD, type MACDItem } from '@shared/lib/macd';
import {
  startTickDetailsSse,
  stopTickDetailsSse,
  onTickDetailsData,
  parseSseResponse,
  type TrendItem,
} from '@/api/tick-details';

interface TimeSharingChartProps {
  id: string;
  setCurrent?: (item: PriceAndVolumeItem | null) => void;
  className?: string;
}

/** MACD 参数 */
const MACD_SHORT = 12;
const MACD_LONG = 26;
const MACD_SIGNAL = 9;

/** 成交额柱子宽度 */
const BAR_WIDTH = 2;

export const TimeSharingChart = memo(({ id, setCurrent, className }: TimeSharingChartProps) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useSize(containerRef);
  const [height, setHeight] = useState(0);
  const [version, setVersion] = useState(0);
  const trendMap = useRef<Map<number, TrendItem>>(new Map());
  const [prePrice, setPrePrice] = useState<number | undefined>(undefined);
  const prePriceRef = useRef<number | undefined>(undefined);

  const { run: updateHeight } = useDebounceFn(
    () => {
      if (size?.height) {
        setHeight(size.height);
      }
    },
    { wait: 100 },
  );

  useEffect(() => {
    updateHeight();
  }, [size, updateHeight]);

  useEffect(() => {
    trendMap.current.clear();
    prePriceRef.current = undefined;
    setPrePrice(undefined);

    startTickDetailsSse(id);
    const off = onTickDetailsData((res) => {
      const { prePrice: pp, trends } = parseSseResponse(res);
      if (pp !== undefined) {
        prePriceRef.current = pp;
        setPrePrice(pp);
      }
      if (trends.length > 0) {
        for (const t of trends) {
          trendMap.current.set(t.timestamp, t);
        }
        setVersion((v) => v + 1);
      }
    });

    return () => {
      off();
      stopTickDetailsSse();
    };
  }, [id]);

  const isDark = theme === 'dark';

  const { trends, chartData, lineColor, yMin, yMax } = useMemo(() => {
    void version;
    const pp = prePriceRef.current;
    const sorted = Array.from(trendMap.current.values()).sort((a, b) => a.timestamp - b.timestamp);

    const equalColor = isDark ? '#ccc' : '#333';

    // 计算 MACD
    const closes = sorted.map((t) => t.close);
    const macdItems: MACDItem[] = computeMACD(closes, MACD_SHORT, MACD_LONG, MACD_SIGNAL);

    const data = sorted.map((t, i) => {
      const prev = i > 0 ? sorted[i - 1] : undefined;
      let barColor: string;
      if (!prev) {
        barColor = equalColor;
      } else if (t.close > prev.close) {
        barColor = RED_COLOR;
      } else if (t.close < prev.close) {
        barColor = GREEN_COLOR;
      } else {
        barColor = equalColor;
      }

      const m = macdItems[i];
      const macdColor = m.macd >= 0 ? RED_COLOR : GREEN_COLOR;
      const changeRate = pp !== undefined ? ((t.close - pp) / pp) * 100 : 0;

      return {
        time: dayjs(t.timestamp).format('HH:mm:ss'),
        price: t.close,
        avgPrice: t.avgPrice,
        turnover: t.turnover,
        volume: t.volume,
        barColor,
        changeRate: round2(changeRate),
        dif: m.dif,
        dea: m.dea,
        macd: m.macd,
        macdColor,
      };
    });

    const lastPrice = sorted.at(-1)?.close;
    const color =
      pp === undefined || lastPrice === undefined
        ? RED_COLOR
        : lastPrice > pp
          ? RED_COLOR
          : lastPrice < pp
            ? GREEN_COLOR
            : equalColor;

    let min: number | undefined;
    let max: number | undefined;
    if (pp !== undefined && sorted.length > 0) {
      const todayHigh = Math.max(...sorted.map((t) => t.high));
      const todayLow = Math.min(...sorted.map((t) => t.low));
      const amplitude = Math.max(Math.abs(todayHigh - pp), Math.abs(todayLow - pp));
      min = pp - amplitude;
      max = pp + amplitude;
    }

    return { trends: sorted, chartData: data, lineColor: color, yMin: min, yMax: max };
  }, [version, isDark]);

  // 更新头部价格信息
  useEffect(() => {
    if (trends.length === 0 || prePriceRef.current === undefined) return;
    const last = trends[trends.length - 1];
    const pp = prePriceRef.current;
    setCurrent?.({
      period: PeriodType.MINUTE,
      timestamp: last.timestamp,
      open: pp,
      close: last.close,
      high: last.high,
      low: last.low,
      volume: last.volume,
      turnover: last.turnover,
      amplitude: 0,
      changeRate: ((last.close - pp) / pp) * 100,
      change: last.close - pp,
      turnoverRate: 0,
    });
  }, [trends, setCurrent]);

  // 显式声明坐标轴类型，避免 TypeScript 联合类型推断到 Polar
  // 带 id 的轴在 layout 中拥有自己的 grid cell
  const axes: ICartesianAxisSpec[] = useMemo(
    () => [
      // 价格左轴
      {
        id: 'axis-price-left',
        orient: 'left',
        regionId: 'price',
        min: yMin,
        max: yMax,
        grid: { visible: true, style: { stroke: isDark ? '#333' : '#eee' } },
        label: {
          style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
        },
        domainLine: { visible: false },
        tick: { visible: false },
      },
      // 涨跌幅右
      {
        id: 'axis-price-right',
        orient: 'right',
        regionId: 'price',
        min: yMin,
        max: yMax,
        grid: { visible: false },
        label: {
          style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
          formatMethod: (raw: string | string[]) => {
            if (!prePrice) {
              return '0.00%';
            }
            const value = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
            return `${(((Number(value) - prePrice) / prePrice) * 100).toFixed(2)}%`;
          },
        },
        domainLine: { visible: false },
        tick: { visible: false },
      },
      // 成交额左轴 — 隐藏但必须有，bar 系列依赖它获取 y scale
      {
        id: 'axis-volume-left',
        orient: 'left',
        regionId: 'volume',
        label: { visible: true },
        domainLine: { visible: false },
        tick: { visible: false },
      },
      // MACD 左轴 — 独占 grid cell (col 0, row 2)
      {
        id: 'axis-macd-left',
        orient: 'left',
        regionId: 'macd',
        label: {
          visible: true,
        },
        domainLine: { visible: false },
        tick: { visible: false },
      },
      // 时间轴 (region: macd, 底部) — 叠加在 macd region 内
      {
        id: 'time',
        orient: 'bottom',
        regionId: ['price', 'volume', 'macd'],
        type: 'band',
        tick: { visible: false },
        label: {
          visible: true,
          style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
        },
        domainLine: { style: { stroke: isDark ? '#333' : '#ddd' } },
      },
    ],
    [isDark, yMin, yMax, prePrice],
  );

  const spec = useMemo<ICommonChartSpec>(
    () => ({
      type: 'common',
      height,
      data: { values: chartData },
      background: 'transparent',
      animationUpdate: false,

      // ---- 网格布局 ----
      layout: {
        type: 'grid',
        col: 12,
        row: 27,
        elements: [
          { modelId: 'axis-price-left', col: 0, row: 0, rowSpan: 16 },
          { modelId: 'axis-price-right', col: 11, row: 0, rowSpan: 16 },
          { modelId: 'price', col: 1, colSpan: 10, row: 0, rowSpan: 16 },
          { modelId: 'axis-volume-left', col: 0, row: 17, rowSpan: 4 },
          { modelId: 'volume', col: 1, colSpan: 10, row: 17, rowSpan: 4 },
          { modelId: 'axis-macd-left', col: 0, row: 22, rowSpan: 4 },
          { modelId: 'macd', col: 1, colSpan: 10, row: 22, rowSpan: 4 },
          { modelId: 'time', col: 1, colSpan: 10, row: 26, rowSpan: 1 },
        ],
      },

      // ---- 区域 ----
      region: [
        {
          id: 'price',
          style: {
            stroke: isDark ? '#333' : '#ddd',
            lineWidth: 1,
            strokeBottom: false,
            strokeLeft: false,
            strokeRight: false,
          },
        },
        {
          id: 'volume',
          style: {
            stroke: isDark ? '#333' : '#ddd',
            lineWidth: 1,
            strokeTop: false,
            strokeLeft: false,
            strokeRight: false,
          },
        },
        {
          id: 'macd',
          style: {
            stroke: isDark ? '#333' : '#ddd',
            lineWidth: 1,
            strokeTop: false,
            strokeLeft: false,
            strokeRight: false,
          },
        },
      ],

      // ---- 系列 ----
      series: [
        // 价格面积图 (region: price)
        {
          type: 'area',
          regionId: 'price',
          xField: 'time',
          yField: 'price',
          line: {
            style: { stroke: lineColor, lineWidth: 1 },
          },
          area: {
            style: {
              fill: {
                gradient: 'linear',
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 1,
                stops: [
                  { offset: 0, color: `${lineColor}33` },
                  { offset: 1, color: `${lineColor}03` },
                ],
              },
            },
          },
          point: { visible: false },
        },
        // 均线 (region: price)
        {
          type: 'line',
          regionId: 'price',
          xField: 'time',
          yField: 'avgPrice',
          line: {
            style: {
              stroke: isDark ? '#ffaa33' : '#e6a817',
              lineWidth: 1,
            },
          },
          point: { visible: false },
        },
        // 成交额柱状图 (region: volume)
        {
          type: 'bar',
          regionId: 'volume',
          xField: 'time',
          yField: 'volume',
          barWidth: BAR_WIDTH,
          bar: {
            style: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fill: (datum: any) => datum.barColor ?? '#ccc',
            },
          },
        },
        // MACD 柱状图 (region: macd)
        {
          type: 'bar',
          regionId: 'macd',
          xField: 'time',
          yField: 'macd',
          barWidth: BAR_WIDTH,
          bar: {
            style: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fill: (datum: any) => datum.macdColor ?? RED_COLOR,
            },
          },
        },
        // DIF 快线 (region: macd)
        {
          type: 'line',
          regionId: 'macd',
          xField: 'time',
          yField: 'dif',
          line: {
            style: {
              stroke: isDark ? '#e0e0e0' : '#333333',
              lineWidth: 1,
            },
          },
          point: { visible: false },
        },
        // DEA 慢线 (region: macd)
        {
          type: 'line',
          regionId: 'macd',
          xField: 'time',
          yField: 'dea',
          line: {
            style: {
              stroke: isDark ? '#ffaa33' : '#e6a817',
              lineWidth: 1,
            },
          },
          point: { visible: false },
        },
      ],

      axes,

      // ---- 十字准线（跨区域同步） ----
      crosshair: {
        regionId: ['price', 'volume', 'macd'],
        xField: {
          visible: true,
          bindingAxesIndex: [4],
          line: { type: 'line', style: { lineWidth: 1, stroke: '#888', lineDash: [3, 3] } },
          label: { visible: false },
        },
        yField: {
          visible: true,
          bindingAxesIndex: [0, 1, 2, 3],
          line: { type: 'line', style: { lineWidth: 1, stroke: '#555', lineDash: [3, 3] } },
          label: { visible: false },
        },
      },

      // ---- 工具提示 ----
      tooltip: {
        visible: true,
      },
    }),
    [chartData, lineColor, height, isDark, axes],
  );

  return (
    <div
      ref={containerRef}
      className={`relative border rounded-xl w-full h-full overflow-hidden ${className || ''}`}
    >
      {chartData.length > 0 && height > 0 ? (
        <VChart spec={spec} options={{ animation: false }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          等待分时数据...
        </div>
      )}
    </div>
  );
});

TimeSharingChart.displayName = 'TimeSharingChart';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
