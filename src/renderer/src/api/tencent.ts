import dayjs from 'dayjs';
import { request } from '@/lib/request';
import { RequestType } from '@shared/types/request';
import type { TrendItem } from '@/api/tick-details';

const TENCENT_MINUTE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query';
const TENCENT_REFERER = 'https://gu.qq.com/';

/**
 * 东财 secid（如 1.600519）→ 腾讯代码（sh600519 / sz000001 / bj8xxxxx）
 */
export function secidToTencentCode(id: string): string {
  const [market, code] = id.split('.');
  if (market === '1') return `sh${code}`;
  // 北交所代码以 4 / 8 / 92 开头
  if (code.startsWith('4') || code.startsWith('8') || code.startsWith('92')) return `bj${code}`;
  return `sz${code}`;
}

interface TencentMinuteResponse {
  code?: number;
  msg?: string;
  data?: {
    [code: string]: {
      data?: { data?: string[]; date?: string };
      qt?: { [code: string]: string[] };
    };
  } | null;
}

const toNum = (s: string | undefined): number | undefined => {
  if (s === undefined || s === '') return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
};

/** 是否落在 A 股连续竞价时段（09:30–11:30 / 13:00–15:00） */
function inTradingSession(hhmm: number): boolean {
  return (hhmm >= 930 && hhmm <= 1130) || (hhmm >= 1300 && hhmm <= 1500);
}

/**
 * 解析腾讯分时接口返回，转成与东财 trends2 一致的 TrendItem 结构。
 * 腾讯分时只提供「分钟价 + 累计量 + 累计额」，无每分 OHLC，故 open/high/low 均用分钟价填充。
 * 注意：volume / turnover 是当日累计值（腾讯原始口径），非单分钟增量。
 */
export function parseTencentMinute(
  txCode: string,
  res: TencentMinuteResponse,
): { prePrice?: number; trends: TrendItem[] } {
  const block = res.data?.[txCode];
  const minuteData = block?.data?.data ?? [];
  const date = block?.data?.date ?? '';
  const qt = block?.qt?.[txCode];

  // 昨收价：最新价(下标3) - 涨跌额(下标31)，对股票/ETF/指数均通用
  let prePrice: number | undefined;
  const price = toNum(qt?.[3]);
  const change = toNum(qt?.[31]);
  if (price !== undefined && change !== undefined) {
    prePrice = price - change;
  }

  const y = date.slice(0, 4);
  const m = date.slice(4, 6);
  const d = date.slice(6, 8);

  const trends: TrendItem[] = [];
  for (const line of minuteData) {
    const [hhmm, priceStr, cumVolStr, cumAmountStr] = line.split(' ');
    const hhmmNum = Number(hhmm);
    if (!inTradingSession(hhmmNum)) continue;

    const close = Number(priceStr);
    const volume = Number(cumVolStr);
    const amount = Number(cumAmountStr);

    trends.push({
      timestamp: dayjs(`${y}-${m}-${d} ${hhmm.slice(0, 2)}:${hhmm.slice(2)}`).valueOf(),
      open: close,
      high: close,
      low: close,
      close,
      volume,
      turnover: amount,
      avgPrice: close,
    });
  }

  return { prePrice, trends };
}

export async function fetchTencentMinute(
  id: string,
): Promise<{ prePrice?: number; trends: TrendItem[] }> {
  const txCode = secidToTencentCode(id);
  const res = await request(
    RequestType.GET,
    TENCENT_MINUTE_URL,
    { code: txCode },
    { Referer: TENCENT_REFERER },
  );
  return parseTencentMinute(txCode, res as TencentMinuteResponse);
}
