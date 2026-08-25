import { memo, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useSize } from 'ahooks';
import { useAtomValue } from 'jotai';
import { init, dispose, CandleType, type Chart as ChartObject } from 'klinecharts';
import { PeriodType, type PriceAndVolumeItem } from '@shared/types/stock';
import type { KeyMove } from '@shared/types/key-move';
import { GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { formatValue, isValid } from '@/lib/fork-form-klinecharts';
import { themeAtom } from '@/models/global';
import { fetchKLines } from '@/api/klines';
import { KDJ_COLORS, DARK_KDJ_COLORS } from './helper'; // 同时触发 keyMove 矩形 overlay 的模块级注册

const KEY_MOVE_COLOR = '#7c3aed';
const INDICATOR_HEIGHT = 80;
/** 滚动定位：把区间起点向右偏移 75 根，让高亮区间尽量落在屏幕中间 */
const SCROLL_OFFSET = 75;

interface KeyMoveChartProps {
  secid: string;
  move: KeyMove;
}

const dateOf = (t: number) => dayjs(t).format('YYYY-MM-DD');

/** 按日期（YYYY-MM-DD）找 K 线下标，找不到用 fallback */
function findIndex(list: PriceAndVolumeItem[], date: string, fallback: number): number {
  const idx = list.findIndex((k) => dateOf(k.timestamp) === date);
  return idx >= 0 ? idx : fallback;
}

/** 轻量 K 线图：蜡烛 + ZX-TREND/成交量/KDJ/MACD + 关键区间矩形，点击关键区间后打开 */
export const KeyMoveChart = memo(({ secid, move }: KeyMoveChartProps) => {
  const theme = useAtomValue(themeAtom);
  const chartId = `key-move-${secid}-${move.key}`;
  const divRef = useRef<HTMLDivElement>(null);
  const size = useSize(divRef);
  const [chart, setChart] = useState<ChartObject | null>(null);
  const [list, setList] = useState<PriceAndVolumeItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchKLines(secid, PeriodType.DAY)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [secid]);

  useEffect(() => {
    if (!list.length) return;
    const chart = init(chartId);
    if (!chart) return;
    chart.applyNewData(list);
    chart.setStyles({
      grid: { show: false },
      candle: {
        type: CandleType.CandleUpStroke,
        bar: {
          upColor: RED_COLOR,
          upBorderColor: RED_COLOR,
          upWickColor: RED_COLOR,
          downColor: GREEN_COLOR,
          downBorderColor: GREEN_COLOR,
          downWickColor: GREEN_COLOR,
        },
      },
      indicator: {
        bars: [
          {
            downColor: GREEN_COLOR,
            upColor: RED_COLOR,
          },
        ],
      },
      separator: { color: theme === 'dark' ? '#333' : '#ddd' },
      xAxis: { axisLine: { color: theme === 'dark' ? '#333' : '#ddd' } },
      yAxis: { axisLine: { color: theme === 'dark' ? '#333' : '#ddd' } },
    });

    // 指标写死（day 用 ZX-TREND）：趋势 + 成交量 + KDJ + MACD
    chart.createIndicator(
      {
        visible: true,
        name: 'ZX-TREND',
        shouldOhlc: false,
        styles: {
          lines: [
            { color: theme === 'dark' ? 'white' : 'black', size: 1 },
            { color: theme === 'dark' ? 'yellow' : 'orange', size: 1 },
          ],
        },
      },
      true,
      { id: 'candle_pane', height: INDICATOR_HEIGHT },
    );
    chart.createIndicator({
      name: 'VOL',
      figures: [
        { key: 'ma1', title: 'MA5: ', type: 'line' },
        { key: 'ma2', title: 'MA10: ', type: 'line' },
        { key: 'ma3', title: 'MA20: ', type: 'line' },
        {
          key: 'volume',
          title: 'VOLUME: ',
          type: 'bar',
          baseValue: 0,
          styles: ({ data, indicator, defaultStyles }) => {
            const prev = data.prev as PriceAndVolumeItem | undefined;
            const current = data.current as PriceAndVolumeItem | undefined;
            let color = formatValue(
              indicator.styles,
              'bars[0].noChangeColor',
              defaultStyles!.bars[0].noChangeColor,
            );
            if (isValid(current) && isValid(prev)) {
              if (current.close > prev.close) {
                color = formatValue(
                  indicator.styles,
                  'bars[0].upColor',
                  defaultStyles!.bars[0].upColor,
                );
              } else if (current.close < prev.close) {
                color = formatValue(
                  indicator.styles,
                  'bars[0].downColor',
                  defaultStyles!.bars[0].downColor,
                );
              }
            }
            return { color: color as string };
          },
        },
      ],
    });
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
      { height: INDICATOR_HEIGHT },
    );
    chart.createIndicator({
      name: 'MACD',
      styles: { height: INDICATOR_HEIGHT },
    });

    // 圈出区间：x = 起止日期，y = 区间内最低 low ~ 最高 high
    const startIdx = findIndex(list, move.start, 0);
    const endIdx = findIndex(list, move.end, list.length - 1);
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    let rangeHigh = -Infinity;
    let rangeLow = Infinity;
    for (let i = lo; i <= hi; i++) {
      rangeHigh = Math.max(rangeHigh, list[i].high);
      rangeLow = Math.min(rangeLow, list[i].low);
    }
    chart.createOverlay({
      name: 'keyMove',
      paneId: 'candle_pane',
      lock: true,
      points: [
        { timestamp: list[lo].timestamp, value: rangeHigh },
        { timestamp: list[hi].timestamp, value: rangeLow },
      ],
      styles: { color: KEY_MOVE_COLOR },
    });
    chart.scrollToDataIndex(Math.min(lo + SCROLL_OFFSET, list.length - 1));
    setChart(chart);

    return () => {
      dispose(chartId);
    };
  }, [list, move, theme, chartId]);

  useEffect(() => {
    chart?.resize();
  }, [chart, size]);

  return <div ref={divRef} id={chartId} className="w-full h-full" />;
});
KeyMoveChart.displayName = 'KeyMoveChart';
