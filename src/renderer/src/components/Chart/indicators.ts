import { Chart as ChartObject } from 'klinecharts';
import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';
import { periodType2MaPeriods } from '@/lib/constants';
import { formatValue, isValid } from '@/lib/fork-form-klinecharts';
import { MA_COLORS, DARK_MA_COLORS, KDJ_COLORS, DARK_KDJ_COLORS } from './helper';
import { ZX_TRENDS, LARGET_INDICATOR_HEIGHT, MINI_INDICATOR_HEIGHT } from './types';

interface SetupIndicatorsOptions {
  period: PeriodType;
  theme: 'light' | 'dark';
  mini: boolean;
  hideVol: boolean;
  /** overlay（缠论）初始可见性 */
  visible: boolean;
}

/**
 * 在已初始化的图表上创建主图叠加指标与副图指标。
 */
export function setupIndicators(
  chart: ChartObject,
  { period, theme, mini, hideVol, visible }: SetupIndicatorsOptions,
): void {
  const paneHeight = mini ? MINI_INDICATOR_HEIGHT : LARGET_INDICATOR_HEIGHT;

  if (ZX_TRENDS.includes(period)) {
    chart.createIndicator(
      {
        visible: !visible,
        name: 'ZX-TREND',
        shouldOhlc: false,
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
      { id: 'candle_pane', height: paneHeight },
    );
  } else {
    chart.createIndicator(
      {
        visible: !visible,
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
      { id: 'candle_pane', height: paneHeight },
    );
  }

  if (!hideVol) {
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
  }

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
    { height: paneHeight },
  );

  chart.createIndicator({
    name: 'MACD',
    styles: {
      height: paneHeight,
    },
  });
}
