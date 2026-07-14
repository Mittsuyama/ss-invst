import { memo, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { RED_COLOR, GREEN_COLOR } from '@/lib/constants';
import {
  startTickDetailsSse,
  stopTickDetailsSse,
  onTickDetailsData,
  parseSseResponse,
  type TrendItem,
} from '@/api/tick-details';

interface MiniTimeSharingChartProps {
  /** 股票 secid（例如 "1.000001"） */
  id: string;
  /** SVG 视口宽度（默认 100） */
  width?: number;
  /** SVG 视口高度（默认 32） */
  height?: number;
  className?: string;
}

/** 6 位代码的股票，交易时间 9:30–15:00，横轴按实际时间映射 */
const SIX_DIGIT_RE = /^\d+\.\d{6}$/;

interface SvgPoint {
  x: number;
  y: number;
}

interface TradingSession {
  start: number;
  end: number;
}

/** 交易时段定义（便于适配不同交易所） */
const TRADING_SESSIONS: { hour: number; minute: number }[][] = [
  [
    { hour: 9, minute: 30 },
    { hour: 11, minute: 30 },
  ],
  [
    { hour: 13, minute: 0 },
    { hour: 15, minute: 0 },
  ],
];

/**
 * 根据趋势数据的第一个点反推当天的交易时段时间戳。
 * 避免用 dayjs() 取"现在"导致与数据日期不一致。
 */
function getTradingSessionsFromData(firstTimestamp: number): TradingSession[] {
  const dataDate = dayjs(firstTimestamp).startOf('day');
  return TRADING_SESSIONS.map(([startTime, endTime]) => ({
    start: dataDate.hour(startTime.hour).minute(startTime.minute).valueOf(),
    end: dataDate.hour(endTime.hour).minute(endTime.minute).valueOf(),
  }));
}

/** 按 5 分钟间隔采样：首尾保留原值，中间取均值。 */
function sampleTrends(trends: TrendItem[]): TrendItem[] {
  if (trends.length <= 2) return trends;

  const INTERVAL_MS = 5 * 60 * 1000;

  // 按 5 分钟桶分组
  const buckets = new Map<number, TrendItem[]>();
  for (const t of trends) {
    const key = Math.floor(t.timestamp / INTERVAL_MS) * INTERVAL_MS;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  if (sortedKeys.length <= 2) return trends;

  const firstKey = sortedKeys[0];
  const lastKey = sortedKeys[sortedKeys.length - 1];

  const result: TrendItem[] = [];

  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!;
    if (key === firstKey) {
      // 第一个桶：保留第一笔原始数据
      result.push(bucket[0]);
    } else if (key === lastKey) {
      // 最后一个桶：保留最后一笔原始数据
      result.push(bucket[bucket.length - 1]);
    } else {
      // 中间桶：取均值
      const n = bucket.length;
      const avg = (fn: (t: TrendItem) => number) => bucket.reduce((s, t) => s + fn(t), 0) / n;
      const mid = bucket[Math.floor(n / 2)];
      result.push({
        timestamp: mid.timestamp,
        open: avg((t) => t.open),
        close: avg((t) => t.close),
        high: Math.max(...bucket.map((t) => t.high)),
        low: Math.min(...bucket.map((t) => t.low)),
        volume: avg((t) => t.volume),
        turnover: avg((t) => t.turnover),
        avgPrice: avg((t) => t.avgPrice),
      });
    }
  }

  return result;
}

function trendsToPoints(
  trends: TrendItem[],
  isSixDigit: boolean,
  width: number,
  height: number,
  prePrice: number | undefined,
): {
  points: SvgPoint[];
  preCloseY: number | undefined;
} {
  if (trends.length === 0) {
    return { points: [], preCloseY: undefined };
  }

  // 价格范围（含 5% 上下留白，prePrice 也纳入范围以防昨收价跑出可视区）
  const prices = trends.map((t) => t.close);
  if (prePrice !== undefined) prices.push(prePrice);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = range * 0.05;
  const adjustedMin = min - padding;
  const adjustedMax = max + padding;
  const adjustedRange = adjustedMax - adjustedMin;

  const toY = (price: number) => height - ((price - adjustedMin) / adjustedRange) * height;

  // X 坐标
  const n = trends.length;
  let points: SvgPoint[];

  if (isSixDigit) {
    const sessions = getTradingSessionsFromData(trends[0].timestamp);
    const totalMs = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);

    points = trends.map((t) => {
      let cumulativeMs = 0;
      for (const session of sessions) {
        const sessionMs = session.end - session.start;
        if (t.timestamp < session.start) {
          // 时段之前：钳到该时段起点
          return { x: (cumulativeMs / totalMs) * width, y: toY(t.close) };
        }
        if (t.timestamp <= session.end) {
          // 时段之内
          const elapsed = t.timestamp - session.start;
          return {
            x: ((cumulativeMs + elapsed) / totalMs) * width,
            y: toY(t.close),
          };
        }
        cumulativeMs += sessionMs;
      }
      // 所有时段之后：钳到末尾
      return { x: width, y: toY(t.close) };
    });
  } else {
    // 非 6 位代码：均匀分布
    points = trends.map((t, i) => ({
      x: n === 1 ? width / 2 : (i / (n - 1)) * width,
      y: toY(t.close),
    }));
  }

  const preCloseY = prePrice !== undefined ? toY(prePrice) : undefined;

  return { points, preCloseY };
}

function buildLinePath(points: SvgPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
}

function buildAreaPath(points: SvgPoint[], height: number): string {
  if (points.length === 0) return '';
  const line = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  // 从线末端下沉到底部，回到起点下方，闭合
  return `${line}L${last.x.toFixed(1)},${height}L${first.x.toFixed(1)},${height}Z`;
}

export const MiniTimeSharingChart = memo(
  ({ id, width = 100, height = 32, className }: MiniTimeSharingChartProps) => {
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const prePriceRef = useRef<number | undefined>(undefined);
    const [version, setVersion] = useState(0);

    const isSixDigit = SIX_DIGIT_RE.test(id);

    useEffect(() => {
      setTrends([]);
      prePriceRef.current = undefined;
      setVersion(0);

      startTickDetailsSse(id);
      const off = onTickDetailsData(id, (res) => {
        const { prePrice: pp, trends: newTrends } = parseSseResponse(res);
        if (pp !== undefined) {
          prePriceRef.current = pp;
        }
        if (newTrends.length > 0) {
          setTrends((prev) => {
            const map = new Map(prev.map((t) => [t.timestamp, t]));
            for (const t of newTrends) {
              map.set(t.timestamp, t);
            }
            return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
          });
          setVersion((v) => v + 1);
        }
      });

      return () => {
        off();
        stopTickDetailsSse(id);
      };
    }, [id]);

    const { linePath, areaPath, lineColor, gradientId, preCloseY } = useMemo(() => {
      void version;
      const pp = prePriceRef.current;

      if (trends.length === 0) {
        const midY = height / 2;
        return {
          linePath: `M0,${midY}L${width},${midY}`,
          areaPath: '',
          lineColor: '#888',
          gradientId: null,
          preCloseY: undefined,
        };
      }

      const sampled = sampleTrends(trends);

      const { points, preCloseY: pcY } = trendsToPoints(sampled, isSixDigit, width, height, pp);

      const lastClose = sampled[sampled.length - 1].close;
      const color = pp === undefined ? RED_COLOR : lastClose >= pp ? RED_COLOR : GREEN_COLOR;

      const gradId = `spk-${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

      return {
        linePath: buildLinePath(points),
        areaPath: buildAreaPath(points, height),
        lineColor: color,
        gradientId: gradId,
        preCloseY: pcY,
      };
    }, [trends, version, width, height, id, isSixDigit]);

    const isEmpty = trends.length === 0;

    return (
      <div className={`inline-flex items-center justify-center ${className || ''}`}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {isEmpty ? (
            <line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="#888"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ) : (
            <>
              {gradientId && (
                <defs>
                  <linearGradient id={gradientId} x1={0} y1={0} x2={0} y2={1}>
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
              )}
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
              <path
                d={linePath}
                stroke={lineColor}
                strokeWidth={1.2}
                fill="none"
                strokeLinejoin="round"
              />
              {preCloseY !== undefined && (
                <line
                  x1={0}
                  y1={preCloseY}
                  x2={width}
                  y2={preCloseY}
                  stroke={lineColor}
                  strokeWidth={0.6}
                  strokeDasharray="2 1.5"
                  opacity={0.5}
                />
              )}
            </>
          )}
        </svg>
      </div>
    );
  },
);

MiniTimeSharingChart.displayName = 'MiniTimeSharingChart';
