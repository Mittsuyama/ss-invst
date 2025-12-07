import { ChartType, PeriodType } from '@shared/types/stock';

export const PRICE_COLOR = '#ad5a00';
// export const GREEN_COLOR = '#6cd3b0';
export const GREEN_COLOR = '#00a870';
// export const RED_COLOR = '#fb6888';
export const RED_COLOR = '#f03a55';

export const DARK_GREEN_COLOR = '#238a67';
export const DARK_RED_COLOR = '#b21f3f';

// export const GREEN_RGB = '108,211,176';
// export const RED_RGB = '251,104,136';
export const GREEN_RGB = '0,153,51';
export const RED_RGB = '240,58,85';

export const chartType2PeriodTypes: Record<ChartType, PeriodType[]> = {
  [ChartType.MINUTE]: [PeriodType.MINUTE, PeriodType.HALF_HOUR, PeriodType.HOUR],
  [ChartType.HALF_HOUR]: [PeriodType.HALF_HOUR],
  [ChartType.HOUR]: [PeriodType.HOUR],
  [ChartType.DAY]: [PeriodType.DAY],
  [ChartType.WEEK]: [PeriodType.WEEK],
  [ChartType.MONTH]: [PeriodType.MONTH],
  [ChartType.WEEK_AND_DAY]: [PeriodType.WEEK, PeriodType.DAY],
};

export const periodTitle: Record<PeriodType, string> = {
  [PeriodType.MINUTE]: '1分钟',
  [PeriodType.HALF_HOUR]: '30分钟',
  [PeriodType.HOUR]: '60分钟',
  [PeriodType.DAY]: '日',
  [PeriodType.WEEK]: '周',
  [PeriodType.MONTH]: '月',
};

export const periodType2MaPeriods: Record<PeriodType, number[]> = {
  [PeriodType.MINUTE]: [7, 14, 25, 60],
  [PeriodType.HALF_HOUR]: [7, 14, 25, 60],
  [PeriodType.HOUR]: [7, 14, 25, 60],
  [PeriodType.DAY]: [7, 14, 25, 60, 235],
  [PeriodType.WEEK]: [7, 14, 25, 60],
  [PeriodType.MONTH]: [7, 14, 25, 60],
};
