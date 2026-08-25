import { memo, useEffect, useRef, useState, useMemo } from 'react';
import clsx from 'clsx';
import { useSize, useDebounceFn, useMemoizedFn } from 'ahooks';
import { useAtom, useAtomValue } from 'jotai';
import { init, dispose, ActionType, Chart as ChartObject } from 'klinecharts';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { themeAtom } from '@/models/global';
import { fetchKLines } from '@/api/klines';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarSpace } from '@/types/global';
import { barSpaceInPeriodAtom } from '@/models/detail';
import { useLatestRequest } from '@/hooks/use-latest-request';
import { BAR_SPACE_SIZE, BAR_SPACE_TITLE } from './helper';
import { buildChanlunOverlays } from './overlays';
import { buildChartStyles } from './chartStyles';
import { setupIndicators } from './indicators';
import { buildPinbarOverlays, PinbarStopMode } from './pinbar';
import { CHART_ID_PREFIX, ZX_TRENDS, ChartProps } from './types';

/** pinbar 止损档位（后期可调：aggressive | conservative） */
const PINBAR_STOP_MODE: PinbarStopMode = 'aggressive';

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
    autoSelectLast,
  }: ChartProps) => {
    const theme = useAtomValue(themeAtom);
    const [barSpaceInPeriod, setBarSpaceInPeriod] = useAtom(barSpaceInPeriodAtom);
    const [chart, setChart] = useState<ChartObject | null>(null);
    const [unchangableOverlayVisible] = useState(overlayVisible);
    const [unchangableBarSpace] = useState(barSpaceInPeriod[period]);
    const chartDivRef = useRef<HTMLDivElement>(null);
    // 是否已为当前图表计算并绘制过 chanlun/pinbar overlay（懒加载标记）
    const overlaysDrawnRef = useRef(false);
    // 上一次已应用到图上的 overlayVisible，用于判断是否真正发生变化
    const prevOverlayVisibleRef = useRef(overlayVisible);

    const { data: list } = useLatestRequest(() => fetchKLines(id, period), [id, period]);

    const { run: onDebouncedResize } = useDebounceFn(
      () => {
        chart?.resize();
      },
      { wait: 50 },
    );

    const size = useSize(chartDivRef);
    const last = useMemo(() => list?.at(-1), [list]);

    useEffect(onDebouncedResize, [onDebouncedResize, size]);

    // 自动选中最后一根 K 线作为默认价格
    useEffect(() => {
      if (last && autoSelectLast) {
        setCurrent?.(last);
      }
    }, [autoSelectLast, last, setCurrent]);

    // 指标显影 + chanlun/pinbar overlay 懒加载
    useEffect(() => {
      if (!chart) {
        return;
      }
      const indicatorName = ZX_TRENDS.includes(period) ? 'ZX-TREND' : 'MA';
      chart.overrideIndicator({
        name: indicatorName,
        visible: !overlayVisible,
      });

      const overlayVisibleChanged = overlayVisible !== prevOverlayVisibleRef.current;

      if (!overlaysDrawnRef.current) {
        // 尚未绘制：pinbar 模式（overlayVisible=false）需立即渲染；
        // 缠论模式（默认 true）懒加载，等 overlayVisible 变化时再计算
        if (!overlayVisible || overlayVisibleChanged) {
          if (list) {
            chart.createOverlay([
              ...buildChanlunOverlays(list, period, overlayVisible),
              ...buildPinbarOverlays(list, { stopMode: PINBAR_STOP_MODE }, !overlayVisible),
            ]);
            overlaysDrawnRef.current = true;
          }
        }
      } else if (overlayVisibleChanged) {
        // 已绘制：只切换 visible（缠论与 pinbar 互斥）
        chart.getOverlays().forEach((overlay) => {
          const targetVisible = overlay.name === 'pinbarRange' ? !overlayVisible : overlayVisible;
          if (overlay.visible !== targetVisible) {
            chart.overrideOverlay({
              id: overlay.id,
              visible: targetVisible,
            });
          }
        });
      }

      prevOverlayVisibleRef.current = overlayVisible;
      // list 在闭包中始终为最新数据（chart 非空时 list 必非空），无需加入依赖
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chart, overlayVisible, period]);

    // 初始化图表
    useEffect(() => {
      if (!list) {
        return;
      }
      const chart = init(`${CHART_ID_PREFIX}-${id}-${period}`);
      if (chart) {
        // 新图表实例还没有 overlay，重置懒加载标记
        overlaysDrawnRef.current = false;
        chart.applyNewData(list);
        chart.setStyles(buildChartStyles(theme, !!mini));
        setupIndicators(chart, {
          period,
          theme,
          mini: !!mini,
          hideVol: !!hideVol,
          visible: unchangableOverlayVisible,
        });
        chart.setBarSpace(
          unchangableBarSpace && unchangableBarSpace in BAR_SPACE_SIZE
            ? BAR_SPACE_SIZE[unchangableBarSpace]
            : BAR_SPACE_SIZE[BarSpace.MEDIUM],
        );
        chart.scrollToDataIndex(list.length + (multi ? 1 : 6));
        chart.subscribeAction(ActionType.OnCrosshairChange, (e) => {
          if (typeof e === 'object' && e && 'kLineData' in e) {
            setCurrent?.(e.kLineData as PriceAndVolumeItem);
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
          onMouseOut={() => (autoSelectLast && last ? setCurrent?.(last) : setCurrent?.(null))}
          id={`${CHART_ID_PREFIX}-${id}-${period}`}
          className="w-full h-full overflow-hidden relative z-10"
        />
      </div>
    );
  },
);
Chart.displayName = 'Chart';
