import { memo, useEffect, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useMemoizedFn } from 'ahooks';
import {
  init,
  dispose,
  CandleType,
  ActionType,
  registerOverlay,
  registerFigure,
  Chart as ChartObject,
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
import { scaleInPeriodAtom } from '@renderer/models/detail';
import { Button } from '@/components/ui/button';
// import { chanlunComputeRequest } from '@renderer/lib/request';

const STROKE_COLOR = '#888888DD';
// const PIVOT_COLOR = '#00a6ff';
const UP_PIVOT_COLOR = '#ff8000';
const DOWN_PIVOT_COLOR = '#a6ff00';

const MA_COLORS = ['#888', '#00d9ffaa', '#000dff87', '#a600ff87', '#ff00a287'];

interface PivotAttrs {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PivotStyles {
  color: string;
}

registerFigure<PivotAttrs, PivotStyles>({
  name: 'pivot',
  draw: (ctx, attrs, styles) => {
    const { x1, y1, x2, y2 } = attrs;
    const { color } = styles;
    ctx.beginPath();
    ctx.strokeStyle = `${color}ee`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillStyle = `${color}33`;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  },
  checkEventOn: ({ x, y }, attrs) => {
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

const DEFAULT_SCALE = 0.2;

const CHART_ID_PREFIX = 'detail-klines';
export const Chart = memo(
  ({
    id,
    period,
    setCurrent,
    overlayVisible,
  }: {
    id: string;
    period: PeriodType;
    setCurrent: (item: PriceAndVolumeItem | null) => void;
    overlayVisible: boolean;
  }) => {
    const theme = useAtomValue(themeAtom);
    const [scaleInPeriod, setScaleInPeriod] = useAtom(scaleInPeriodAtom);
    const [list, setList] = useState<PriceAndVolumeItem[] | null>(null);
    const [chart, setChart] = useState<ChartObject | null>(null);
    const [unchangableOverlayVisible] = useState(overlayVisible);
    const [unchangableScale] = useState(scaleInPeriod[period]);

    const onCandleHover = useMemoizedFn((e: unknown) => {
      if (typeof e === 'object' && e && 'kLineData' in e) {
        const data = e.kLineData as PriceAndVolumeItem;
        setCurrent(data);
      }
    });

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
      let didCancel = false;
      (async () => {
        const list = await fetchKLines(id, period);
        if (didCancel) {
          return;
        }
        setList(list);
      })();
      return () => {
        didCancel = true;
      };
    }, [period, id, theme]);

    useEffect(() => {
      if (!list) {
        return;
      }
      const chart = init(`${CHART_ID_PREFIX}-${period}`);
      if (chart) {
        chart.subscribeAction(ActionType.OnCrosshairChange, onCandleHover);
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
          },
          separator: {
            color: theme === 'dark' ? '#333' : '#ddd',
          },
          xAxis: {
            axisLine: {
              color: theme === 'dark' ? '#333' : '#ddd',
            },
          },
          yAxis: {
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
                upColor: PRICE_COLOR,
                downColor: PRICE_COLOR,
                noChangeColor: PRICE_COLOR,
              },
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
          { id: 'candle_pane' },
        );
        // chart.createIndicator('BBI', true, { id: 'candle_pane' });
        chart.createIndicator('VOL');
        chart.createIndicator('KDJ');
        chart.createIndicator('MACD');
        chart.zoomAtTimestamp(unchangableScale || DEFAULT_SCALE, list[list.length - 1].timestamp);
        chart.subscribeAction(ActionType.OnZoom, (data) => {
          const { scale } = (data || {}) as { scale: number };
          if (scale) {
            setScaleInPeriod((pre) => ({
              ...pre,
              [period]: (pre[period] || DEFAULT_SCALE) * (scale ?? 1),
            }));
          }
        });
        setChart(chart);
      }
      return () => {
        dispose(`${CHART_ID_PREFIX}-${period}`);
      };
    }, [
      list,
      period,
      onCandleHover,
      theme,
      unchangableOverlayVisible,
      setScaleInPeriod,
      unchangableScale,
    ]);

    return (
      <div className="relative border rounded-xl w-full h-full overflow-hidden">
        <div className="absolute top-1 right-1 text-xs text-muted-foreground flex gap-2 z-20">
          {/* {periodTitle[period]} */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setScaleInPeriod((pre) => ({
                ...pre,
                [period]: DEFAULT_SCALE,
              }));
              list && chart?.zoomAtTimestamp(DEFAULT_SCALE, list[list.length - 1].timestamp);
            }}
          >
            重置缩放
          </Button>
        </div>
        <div
          id={`${CHART_ID_PREFIX}-${period}`}
          className="w-full h-full overflow-hidden relative z-10"
        />
      </div>
    );
  },
);
Chart.displayName = 'Chart';
