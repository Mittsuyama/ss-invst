import type { TrendItem } from '@/api/tick-details';

export type TickStatus = 'loading' | 'ok' | 'error';

/** 分时数据源类型：腾讯轮询 / 东财 SSE push */
export type TrendSourceKind = 'tencent' | 'eastmoney';

/** 两个数据源 hook 的统一返回结构，便于在页面里一键切换 */
export interface TrendSource {
  /** 每只股票的当日分时数据 */
  trendsMap: Record<string, TrendItem[]>;
  /** 每只股票的昨收价 */
  prePriceMap: Record<string, number>;
  /** 每只股票的分时加载状态 */
  tickStatus: Record<string, TickStatus>;
  /** 加载失败（error）的股票 id 列表 */
  errorTickIds: string[];
  /** 重试单只股票的分时 */
  retryTick: (id: string) => void;
  /** 重试所有失败股票的分时 */
  retryAllTicks: () => void;
}
