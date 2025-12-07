import { KLineData } from 'klinecharts';

/** 股票ID ${ID(number)}:${CODE(string)} */
export type StockId = string;

export interface SearchItem {
  id: StockId;
  market: string;
  name: string;
  code: string;
  securityTypeName: string;
  pinyin: string;
}

export enum PeriodType {
  MINUTE = 'minute',
  FIVE_MINUTE = 'five_minute',
  FIFTEEN_MINUTE = 'fifteen_minute',
  HALF_HOUR = 'half_hour',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export enum ChartType {
  MINUTE = 'minute',
  FIVE_MINUTE = 'five_minute',
  FIFTEEN_MINUTE = 'fifteen_minute',
  HALF_HOUR = 'half_hour',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  WEEK_AND_DAY = 'week_and_day',
  DAY_AND_HOUR = 'day_and_hour',
  DAY_AND_FIVE_MINUTE = 'day_and_five_minute',
}

export interface PriceAndVolumeItem extends KLineData {
  period: PeriodType;
  turnover: number;
  amplitude: number;
  changeRate: number;
  change: number;
  turnoverRate: number;
}

export interface ChanlunK {
  timestamp: number;
  high: number;
  low: number;
  /** 被别的 K 线包含 */
  enclosed?: boolean;
  /** 是否是顶底分形 */
  fractal?: 'top' | 'bottom';
  /** 趋势 */
  trend?: 'up' | 'down';
}

export interface Stroke {
  type: 'up' | 'down';
  start: {
    timestamp: number;
    price: number;
  };
  end: {
    timestamp: number;
    price: number;
  };
}

export type Segment = Stroke;

export interface Pivot {
  type: 'up' | 'down';
  start: number;
  end: number;
  low: number;
  high: number;
}

export interface PivotDpData {
  /** 中枢的类型 */
  type: 'up' | 'down';
  /** 到当前中枢能画出的最大中枢数量 */
  count: number;
  /** 中枢对应的最后一笔 */
  end: number;
  /** 中枢对应的第一笔 */
  start: number;
  /** 前一个中枢 */
  prev?: number;
  /** 中枢的最小价格 */
  low: number;
  /** 中枢的最大价格 */
  high: number;
}

export interface StrokeDpData {
  /** 到当前笔能画出的最大笔数量 */
  count: number;
  /** 笔对应的最后一个分形 */
  target: number;
  /** 前一笔 */
  prev?: number;
  /** 笔的价格差 */
  dif: number;
}

export interface StockInfo {
  id: StockId;
  code: string;
  market: string;
  /** 交易所名称 */
  exchange: string;
  name: string;
  pe: number;
  roe: number;
  pb: number;
  /** 总市值 */
  cap: number;
  /** 业务 id */
  bizId: string;
  /** 业务名称 */
  bizName: string;
  /** 毛利率 */
  gpr: number;
  /** 最新价 */
  price: number;
  /** 上市时间 */
  createTime: number;
  /** 涨跌幅 */
  changeRate: number;
}
