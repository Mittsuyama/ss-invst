import { memo, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSize, useDebounceFn, useMemoizedFn } from 'ahooks';
import { useAtom, useAtomValue } from 'jotai';
import {
  init,
  dispose,
  CandleType,
  ActionType,
  registerOverlay,
  registerFigure,
  Chart as ChartObject,
  TooltipShowRule,
} from 'klinecharts';
import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';
import {
  PRICE_COLOR,
  GREEN_COLOR,
  RED_COLOR,
  DARK_GREEN_COLOR,
  DARK_RED_COLOR,
  periodType2MaPeriods,
} from '@/lib/constants';
import { themeAtom } from '@/models/global';
import { fetchKLines } from '@/api/klines';
import { computePivotWithDp, computeStrokeSimply } from '@shared/lib/chanlun';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarSpace } from '@/types/global';
import { barSpaceInPeriodAtom } from '@/models/detail';
import { useLatestRequest } from '@/hooks/use-latest-request';

const STROKE_COLOR = '#888888DD';
// const PIVOT_COLOR = '#00a6ff';
const UP_PIVOT_COLOR = '#ff8000';
const DOWN_PIVOT_COLOR = '#a6ff00';

const MA_COLORS = ['#888', '#00d9ffaa', '#000dff87', '#a600ff87', '#ff00a287'];
const KDJ_COLORS = ['#868686c5', '#ffb700', '#f700ffa8'];

interface PivotAttrs {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PivotStyles {
  color: string;
  extended?: boolean;
}

registerFigure<PivotAttrs, PivotStyles>({
  name: 'pivot',
  draw: (ctx, attrs, styles) => {
    const { x1, y1, x2, y2 } = attrs;
    const { color, extended } = styles;
    ctx.beginPath();
    ctx.strokeStyle = `${color}ee`;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = `${color}33`;
    if (extended) {
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = `${color}aa`;
      ctx.fillStyle = `${color}11`;
    }
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  },
  checkEventOn: ({ x, y }, attrs, styles) => {
    if (styles.extended) {
      return false;
    }
    const { x1, y1, x2, y2 } = attrs;
    const xRange = [x1, x2].sort((a, b) => a - b);
    const yRange = [y1, y2].sort((a, b) => a - b);
    return x >= xRange[0] && x <= xRange[1] && y >= yRange[0] && y <= yRange[1];
  },
});

registerOverlay({
  name: 'pivot',
  totalStep: 3,
  lock: true,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay }) => {
    return {
      type: 'pivot',
      attrs: {
        x1: coordinates[0].x,
        y1: coordinates[0].y,
        x2: coordinates[1].x,
        y2: coordinates[1].y,
      },
      styles: overlay.styles,
    };
  },
});

interface ChartProps {
  id: string;
  period: PeriodType;
  setCurrent?: (item: PriceAndVolumeItem | null) => void;
  overlayVisible?: boolean;
  className?: string;
  /** 是否显示成交量 */
  hideVol?: boolean;
  /** 隐藏重置缩放按钮 */
  hideResetScale?: boolean;
  /** 迷你图 */
  mini?: boolean;
}

const BAR_SPACE_SIZE: Record<BarSpace, number> = {
  [BarSpace.SMALL]: 2.98,
  [BarSpace.MEDIUM]: 5.76,
  [BarSpace.LARGE]: 8,
};

const BAR_SPACE_TITLE: Record<BarSpace, string> = {
  [BarSpace.SMALL]: '密',
  [BarSpace.MEDIUM]: '中',
  [BarSpace.LARGE]: '疏',
};

const LARGET_INDICATOR_HEIGHT = 80;
const MINI_INDICATOR_HEIGHT = 48;

const CHART_ID_PREFIX = 'detail-klines';
export const Chart = memo(
  ({
    id,
    period,
    setCurrent,
    overlayVisible = true,
    className,
    hideVol,
    hideResetScale,
    mini,
  }: ChartProps) => {
    const theme = useAtomValue(themeAtom);
    const [barSpaceInPeriod, setBarSpaceInPeriod] = useAtom(barSpaceInPeriodAtom);
    const [chart, setChart] = useState<ChartObject | null>(null);
    const [unchangableOverlayVisible] = useState(overlayVisible);
    const [unchangableBarSpace] = useState(barSpaceInPeriod[period]);
    const chartDivRef = useRef<HTMLDivElement>(null);

    const { data: list } = useLatestRequest(() => fetchKLines(id, period), [id, period]);

    const { run: onDebouncedResize } = useDebounceFn(
      () => {
        chart?.resize();
      },
      { wait: 50 },
    );

    const size = useSize(chartDivRef);

    useEffect(onDebouncedResize, [onDebouncedResize, size]);

    useEffect(() => {
      (async () => {
        if (list && chart) {
          const strokes = computeStrokeSimply(list);
          const pivots = computePivotWithDp(strokes);
          // const { strokes, pivots } = await chanlunComputeRequest(list);
          chart.createOverlay([
            ...strokes.map((s) => ({
              visible: unchangableOverlayVisible,
              name: 'segment',
              paneId: 'candle_pane',
              lock: true,
              points: [
                { timestamp: s.start.timestamp, value: s.start.price },
                { timestamp: s.end.timestamp, value: s.end.price },
              ],
              styles: {
                line: {
                  size: 1,
                  color: STROKE_COLOR,
                },
              },
            })),
            ...pivots.map((p) => ({
              visible: unchangableOverlayVisible,
              name: 'pivot',
              paneId: 'candle_pane',
              lock: true,
              points: [
                { timestamp: p.start, value: p.low },
                { timestamp: p.end, value: p.high },
              ],
              styles: {
                color: p.type === 'up' ? UP_PIVOT_COLOR : DOWN_PIVOT_COLOR,
              },
            })),
          ]);
        }
      })();
    }, [list, chart, unchangableOverlayVisible]);

    useEffect(() => {
      if (!chart) {
        return;
      }
      chart.overrideIndicator({
        name: 'MA',
        visible: !overlayVisible,
      });
      const overlays = chart.getOverlays();
      overlays.forEach((overlay) => {
        if (overlay.visible !== overlayVisible) {
          chart.overrideOverlay({
            id: overlay.id,
            visible: overlayVisible,
          });
        }
      });
    }, [chart, overlayVisible]);

    useEffect(() => {
      if (!list) {
        return;
      }
      const chart = init(`${CHART_ID_PREFIX}-${id}-${period}`);
      if (chart) {
        chart.applyNewData(list);
        chart.setOffsetRightDistance(8);
        chart.setStyles({
          grid: {
            show: false,
          },
          indicator: {
            bars: [
              {
                downColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
                upColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              },
            ],
            tooltip: {
              showRule: mini ? TooltipShowRule.FollowCross : TooltipShowRule.Always,
            },
          },
          separator: {
            color: theme === 'dark' ? '#333' : '#ddd',
          },
          xAxis: {
            size: mini ? 0 : 28,
            show: !mini,
            axisLine: {
              color: theme === 'dark' ? '#333' : '#ddd',
            },
          },
          yAxis: {
            size: mini ? 0 : 54,
            show: false,
            // axisLine: {
            //   color: theme === 'dark' ? '#333' : '#ddd',
            // },
          },
          candle: {
            type: CandleType.CandleUpStroke,
            bar: {
              upColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              upBorderColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              upWickColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              downColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
              downBorderColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
              downWickColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
            },
            priceMark: {
              last: {
                show: !mini,
                upColor: PRICE_COLOR,
                downColor: PRICE_COLOR,
                noChangeColor: PRICE_COLOR,
              },
            },
            tooltip: {
              showRule: mini ? TooltipShowRule.FollowCross : TooltipShowRule.Always,
              custom: [
                { title: 'open', value: '{open}' },
                { title: 'high', value: '{high}' },
                { title: 'low', value: '{low}' },
                { title: 'close', value: '{close}' },
              ],
            },
          },
        });
        chart.createIndicator(
          {
            visible: !unchangableOverlayVisible,
            name: 'MA',
            shouldOhlc: false,
            calcParams: periodType2MaPeriods[period],
            styles: {
              lines: MA_COLORS.map((color) => ({
                color,
                size: 1,
              })),
            },
          },
          true,
          { id: 'candle_pane', height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT },
        );
        // chart.createIndicator('BBI', true, { id: 'candle_pane' });
        !hideVol && chart.createIndicator('VOL');
        chart.createIndicator(
          {
            name: 'KDJ',
            styles: {
              lines: KDJ_COLORS.map((color) => ({
                color,
                size: 1,
              })),
            },
          },
          false,
          { height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT },
        );
        // chart.createIndicator('KDJ');
        chart.createIndicator({
          name: 'MACD',
          calcParams: period === PeriodType.DAY ? [5, 34, 5] : undefined,
          styles: {
            height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT,
          },
        });
        chart.setBarSpace(
          unchangableBarSpace && unchangableBarSpace in BAR_SPACE_SIZE
            ? BAR_SPACE_SIZE[unchangableBarSpace]
            : BAR_SPACE_SIZE[BarSpace.MEDIUM],
        );
        chart.scrollToDataIndex(list.length - 1);
        chart.subscribeAction(ActionType.OnCrosshairChange, (e) => {
          if (typeof e === 'object' && e && 'kLineData' in e) {
            const data = e.kLineData as PriceAndVolumeItem;
            setCurrent?.(data);
          }
        });
        setChart(chart);
      }
      return () => {
        dispose(`${CHART_ID_PREFIX}-${id}-${period}`);
      };
    }, [
      list,
      period,
      theme,
      unchangableOverlayVisible,
      unchangableBarSpace,
      setCurrent,
      hideVol,
      id,
      mini,
    ]);

    const onBarSpaceChange = useMemoizedFn((barSpace: BarSpace) => {
      setBarSpaceInPeriod((pre) => ({
        ...pre,
        [period]: barSpace,
      }));
      chart?.setBarSpace(BAR_SPACE_SIZE[barSpace]);
      chart?.scrollToDataIndex((list?.length || 1) - 1);
    });

    return (
      <div className={clsx('relative border rounded-xl w-full h-full overflow-hidden', className)}>
        {!hideResetScale && (
          <div className="absolute top-2 right-2 text-xs text-muted-foreground flex items-center gap-2 z-20">
            <div className="text-xs text-muted-foreground/50">K 线密度</div>
            <Tabs
              value={barSpaceInPeriod[period]}
              onValueChange={(value) => onBarSpaceChange(value as BarSpace)}
            >
              <TabsList className="h-8">
                {[BarSpace.SMALL, BarSpace.MEDIUM, BarSpace.LARGE].map((c) => (
                  <TabsTrigger key={c} value={c.toString()}>
                    {BAR_SPACE_TITLE[c]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
        <div
          ref={chartDivRef}
          onMouseOut={() => setCurrent?.(null)}
          id={`${CHART_ID_PREFIX}-${id}-${period}`}
          className="w-full h-full overflow-hidden relative z-10"
        />
      </div>
    );
  },
);
Chart.displayName = 'Chart';
