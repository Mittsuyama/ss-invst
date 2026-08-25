import { CandleType, DeepPartial, Styles, TooltipShowRule } from 'klinecharts';
import { PRICE_COLOR, GREEN_COLOR, RED_COLOR } from '@/lib/constants';

/**
 * 构建 K 线主图的样式配置。
 */
export function buildChartStyles(
  theme: 'light' | 'dark',
  mini: boolean,
): DeepPartial<Styles> {
  const axisColor = theme === 'dark' ? '#333' : '#ddd';
  const tooltipRule = mini ? TooltipShowRule.FollowCross : TooltipShowRule.Always;

  return {
    grid: {
      show: false,
    },
    indicator: {
      bars: [
        {
          downColor: GREEN_COLOR,
          upColor: RED_COLOR,
        },
      ],
      tooltip: {
        showRule: tooltipRule,
      },
    },
    separator: {
      color: axisColor,
    },
    xAxis: {
      size: mini ? 0 : 28,
      show: !mini,
      axisLine: {
        color: axisColor,
      },
    },
    yAxis: {
      size: mini ? 0 : 54,
      show: false,
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
        showRule: tooltipRule,
        custom: [
          { title: 'open', value: '{open}' },
          { title: 'high', value: '{high}' },
          { title: 'low', value: '{low}' },
          { title: 'close', value: '{close}' },
        ],
      },
    },
  };
}
