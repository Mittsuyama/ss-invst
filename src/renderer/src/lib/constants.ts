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
  [ChartType.FIVE_MINUTE]: [PeriodType.FIVE_MINUTE],
  [ChartType.FIFTEEN_MINUTE]: [PeriodType.FIFTEEN_MINUTE],
  [ChartType.HALF_HOUR]: [PeriodType.HALF_HOUR],
  [ChartType.HOUR]: [PeriodType.HOUR],
  [ChartType.DAY]: [PeriodType.DAY],
  [ChartType.WEEK]: [PeriodType.WEEK],
  [ChartType.MONTH]: [PeriodType.MONTH],
  [ChartType.WEEK_AND_DAY]: [PeriodType.WEEK, PeriodType.DAY],
  [ChartType.DAY_AND_HOUR]: [PeriodType.DAY, PeriodType.HOUR],
  [ChartType.DAY_AND_HALF_HOUR]: [PeriodType.DAY, PeriodType.HALF_HOUR],
  [ChartType.DAY_AND_FIVE_MINUTE]: [PeriodType.DAY, PeriodType.FIVE_MINUTE],
};

export const chartTypeTittle: Record<ChartType, string> = {
  [ChartType.MINUTE]: '1分钟',
  [ChartType.FIVE_MINUTE]: '5分钟',
  [ChartType.FIFTEEN_MINUTE]: '15分钟',
  [ChartType.HALF_HOUR]: '30分钟',
  [ChartType.HOUR]: '60分钟',
  [ChartType.DAY]: '日',
  [ChartType.WEEK]: '周',
  [ChartType.MONTH]: '月',
  [ChartType.WEEK_AND_DAY]: '周/日',
  [ChartType.DAY_AND_HOUR]: '日/60分钟',
  [ChartType.DAY_AND_HALF_HOUR]: '日/30分钟',
  [ChartType.DAY_AND_FIVE_MINUTE]: '日/5分钟',
};

export const periodTitle: Record<PeriodType, string> = {
  [PeriodType.MINUTE]: '1分钟',
  [PeriodType.FIVE_MINUTE]: '5分钟',
  [PeriodType.FIFTEEN_MINUTE]: '15分钟',
  [PeriodType.HALF_HOUR]: '30分钟',
  [PeriodType.HOUR]: '60分钟',
  [PeriodType.DAY]: '日',
  [PeriodType.WEEK]: '周',
  [PeriodType.MONTH]: '月',
};

export const periodType2MaPeriods: Record<PeriodType, number[]> = {
  [PeriodType.MINUTE]: [5, 10, 20, 60],
  [PeriodType.FIVE_MINUTE]: [5, 10, 20, 60],
  [PeriodType.FIFTEEN_MINUTE]: [5, 10, 20, 60],
  [PeriodType.HALF_HOUR]: [5, 10, 20, 60],
  [PeriodType.HOUR]: [5, 10, 20, 60],
  [PeriodType.DAY]: [7, 14, 25, 60, 235],
  [PeriodType.WEEK]: [5, 10, 20, 60],
  [PeriodType.MONTH]: [5, 10, 20, 60],
};
