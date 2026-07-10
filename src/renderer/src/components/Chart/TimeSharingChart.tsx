import { memo, useEffect, useState, useRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { AreaChart, IAreaChartSpec } from '@visactor/react-vchart';
import { useTheme } from 'next-themes';
import { useSize, useDebounceFn } from 'ahooks';
import { PriceAndVolumeItem, PeriodType } from '@shared/types/stock';
import { RED_COLOR, GREEN_COLOR } from '@/lib/constants';
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

    const data = sorted.map((t) => ({
      time: dayjs(t.timestamp).format('HH:mm:ss'),
      price: t.close,
      avgPrice: t.avgPrice,
      volume: t.volume,
    }));

    const equalColor = isDark ? '#ccc' : '#333';
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

  const spec = useMemo<IAreaChartSpec>(
    () => ({
      type: 'area',
      height,
      autoFit: true,
      data: { values: chartData },
      xField: 'time',
      yField: 'price',
      line: {
        style: {
          stroke: lineColor,
          lineWidth: 1,
        },
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
      markLine: prePrice
        ? [
            {
              y: prePrice,
              label: {
                text: `昨收 ${prePrice}`,
                style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
                labelBackground: { visible: false },
              },
              line: {
                style: { lineWidth: 1, stroke: '#888', lineDash: [4, 4] },
              },
              endSymbol: { visible: false },
            },
          ]
        : [],
      axes: [
        {
          orient: 'bottom',
          type: 'band',
          tick: { visible: false, tickCount: 10 },
          label: {
            style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
          },
          grid: { visible: false },
          domainLine: { style: { stroke: isDark ? '#333' : '#ddd' } },
        },
        {
          orient: 'left',
          min: yMin,
          max: yMax,
          grid: { visible: true, style: { stroke: isDark ? '#333' : '#eee' } },
          label: {
            style: { fill: isDark ? '#aaa' : '#666', fontSize: 10 },
          },
          domainLine: { visible: false },
          tick: { visible: false },
        },
      ],
      crosshair: {
        xField: {
          visible: true,
          line: { type: 'line', style: { lineWidth: 1, stroke: '#555', lineDash: [3, 3] } },
          label: { visible: true },
        },
        yField: {
          visible: true,
          line: { type: 'line', style: { lineWidth: 1, stroke: '#555', lineDash: [3, 3] } },
          label: { visible: true },
        },
      },
      tooltip: {
        visible: true,
      },
      point: { visible: false },
      padding: { top: 10, right: 50, bottom: 5, left: 5 },
      background: 'transparent',
      animationUpdate: false,
    }),
    [chartData, lineColor, yMin, yMax, prePrice, height, isDark],
  );

  return (
    <div
      ref={containerRef}
      className={`relative border rounded-xl w-full h-full overflow-hidden ${className || ''}`}
    >
      {chartData.length > 0 && height > 0 ? (
        <AreaChart spec={spec} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          等待分时数据...
        </div>
      )}
    </div>
  );
});

TimeSharingChart.displayName = 'TimeSharingChart';
