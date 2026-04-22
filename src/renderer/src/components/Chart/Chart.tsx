import { memo, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSize, useDebounceFn, useMemoizedFn } from 'ahooks';
import { useAtom, useAtomValue } from 'jotai';
import {
  init,
  dispose,
  CandleType,
  ActionType,
  Chart as ChartObject,
  TooltipShowRule,
} from 'klinecharts';
import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';
import {
  PRICE_COLOR,
  GREEN_COLOR,
  RED_COLOR,
  // DARK_GREEN_COLOR,
  // DARK_RED_COLOR,
  // periodType2MaPeriods,
  NEED_SEGMENTS_PERIOD,
  periodType2MaPeriods,
} from '@/lib/constants';
import { themeAtom } from '@/models/global';
import { fetchKLines } from '@/api/klines';
import {
  computePivotWithDp,
  computeSegmentsSimply,
  computeStrokeSimply,
} from '@shared/lib/chanlun';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarSpace } from '@/types/global';
import { barSpaceInPeriodAtom } from '@/models/detail';
import { useLatestRequest } from '@/hooks/use-latest-request';
import {
  STROKE_COLOR,
  SEGEMENT_COLOR,
  UP_PIVOT_COLOR,
  DOWN_PIVOT_COLOR,
  MA_COLORS,
  DARK_MA_COLORS,
  KDJ_COLORS,
  DARK_KDJ_COLORS,
  BAR_SPACE_SIZE,
  BAR_SPACE_TITLE,
} from './helper';

const ZX_TRENDS: PeriodType[] = [PeriodType.DAY, PeriodType.WEEK];

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
  /** 多图并存 */
  multi?: boolean;
}

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
    multi,
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
          const needSegments = NEED_SEGMENTS_PERIOD.includes(period);
          const strokes = computeStrokeSimply(list);
          const segments = needSegments ? computeSegmentsSimply(strokes) : [];
          const pivots = computePivotWithDp(needSegments ? segments : strokes);
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
            ...segments.map((s) => ({
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
                  size: 2,
                  color: SEGEMENT_COLOR,
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
    }, [list, chart, unchangableOverlayVisible, period]);

    // 指标显影
    useEffect(() => {
      if (!chart) {
        return;
      }
      if (ZX_TRENDS.includes(period)) {
        chart.overrideIndicator({
          name: 'ZX-TREND',
          visible: !overlayVisible,
        });
      } else {
        chart.overrideIndicator({
          name: 'MA',
          visible: !overlayVisible,
        });
      }
      const overlays = chart.getOverlays();
      overlays.forEach((overlay) => {
        if (overlay.visible !== overlayVisible) {
          chart.overrideOverlay({
            id: overlay.id,
            visible: overlayVisible,
          });
        }
      });
    }, [chart, overlayVisible, period]);

    useEffect(() => {
      if (!list) {
        return;
      }
      const chart = init(`${CHART_ID_PREFIX}-${id}-${period}`);
      if (chart) {
        chart.applyNewData(list);
        chart.setStyles({
          grid: {
            show: false,
          },
          indicator: {
            bars: [
              {
                downColor: GREEN_COLOR,
                upColor: RED_COLOR,
                // downColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
                // upColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
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
              upColor: RED_COLOR,
              upBorderColor: RED_COLOR,
              upWickColor: RED_COLOR,
              downColor: GREEN_COLOR,
              downBorderColor: GREEN_COLOR,
              downWickColor: GREEN_COLOR,
              // upColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              // upBorderColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              // upWickColor: theme === 'dark' ? DARK_RED_COLOR : RED_COLOR,
              // downColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
              // downBorderColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
              // downWickColor: theme === 'dark' ? DARK_GREEN_COLOR : GREEN_COLOR,
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
        if (ZX_TRENDS.includes(period)) {
          chart.createIndicator(
            {
              visible: !unchangableOverlayVisible,
              name: 'ZX-TREND',
              shouldOhlc: false,
              // calcParams: periodType2MaPeriods[period],
              styles: {
                lines: [
                  {
                    color: theme === 'dark' ? 'white' : 'black',
                    size: 1,
                  },
                  {
                    color: theme === 'dark' ? 'yellow' : 'orange',
                    size: 1,
                  },
                ],
              },
            },
            true,
            { id: 'candle_pane', height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT },
          );
        } else {
          chart.createIndicator(
            {
              visible: !unchangableOverlayVisible,
              name: 'MA',
              shouldOhlc: false,
              calcParams: periodType2MaPeriods[period],
              styles: {
                lines: (theme === 'dark' ? DARK_MA_COLORS : MA_COLORS).map((color) => ({
                  color,
                  size: 1,
                })),
              },
            },
            true,
            { id: 'candle_pane', height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT },
          );
        }
        // chart.createIndicator('BBI', true, { id: 'candle_pane' });
        !hideVol && chart.createIndicator('VOL');
        chart.createIndicator(
          {
            name: 'KDJ',
            styles: {
              lines: (theme === 'dark' ? DARK_KDJ_COLORS : KDJ_COLORS).map((color) => ({
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
          styles: {
            height: mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT,
          },
        });
        chart.setBarSpace(
          unchangableBarSpace && unchangableBarSpace in BAR_SPACE_SIZE
            ? BAR_SPACE_SIZE[unchangableBarSpace]
            : BAR_SPACE_SIZE[BarSpace.MEDIUM],
        );
        chart.scrollToDataIndex(list.length + (multi ? 1 : 6));
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
      multi,
    ]);

    const onBarSpaceChange = useMemoizedFn((barSpace: BarSpace) => {
      setBarSpaceInPeriod((pre) => ({
        ...pre,
        [period]: barSpace,
      }));
      chart?.setBarSpace(BAR_SPACE_SIZE[barSpace]);
      chart && list && chart.scrollToDataIndex(list.length + (multi ? 1 : 6));
      // chart?.scrollToDataIndex((list?.length || 1) - 1);
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
              <TabsList className="h-7">
                {[
                  BarSpace.EXTRA_SMALL,
                  BarSpace.SMALL,
                  BarSpace.MEDIUM,
                  BarSpace.LARGE,
                  BarSpace.EXTRA_LARGE,
                ].map((c) => (
                  <TabsTrigger className="h-6" key={c} value={c.toString()}>
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
