import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';

/** 使用「涨跌趋势」指标的周期 */
export const ZX_TRENDS: PeriodType[] = [PeriodType.DAY, PeriodType.WEEK];

export const LARGET_INDICATOR_HEIGHT = 80;
export const MINI_INDICATOR_HEIGHT = 48;
export const CHART_ID_PREFIX = 'detail-klines';

export interface ChartProps {
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
  /** 选择最后一个 K 线作为默认价格 */
  autoSelectLast?: boolean;
}
