import axios from 'axios';
import { runtime } from './eastmoney';

const TUSHARE_URL = 'http://api.tushare.pro';

export interface TushareResult {
  fields: string[];
  items: (string | number | null)[][];
  rowCount: number;
}

/** 调用 tushare 的通用 HTTP 接口 */
export async function tushareQuery(
  apiName: string,
  params: Record<string, unknown>,
  fields?: string,
): Promise<TushareResult> {
  const token = runtime.tushareToken;
  if (!token) {
    throw new Error('未配置 Tushare Token，请在「设置环境变量」中填写');
  }
  const body: Record<string, unknown> = {
    api_name: apiName,
    token,
    params: params ?? {},
  };
  if (fields) body.fields = fields;

  const res = await axios.post(TUSHARE_URL, body, { timeout: 30000 });
  const data = res.data as {
    code: number;
    msg?: string;
    data?: { fields: string[]; items: unknown[][] };
  };
  if (data.code !== 0) {
    throw new Error(`Tushare 错误(${data.code}): ${data.msg ?? '未知错误'}`);
  }
  const fieldsList = data.data?.fields ?? [];
  const items = (data.data?.items ?? []) as (string | number | null)[][];
  // 单行结果兼容
  const rows =
    items.length && Array.isArray(items[0])
      ? items
      : [items as unknown as (string | number | null)[]];
  return { fields: fieldsList, items: rows, rowCount: rows.length };
}

// ============================================================
// 复权日线（daily + adj_factor 计算前/后/不复权）
// ============================================================

/** 复权方式：qfq 前复权 / hfq 后复权 / bfq 不复权 */
export type AdjustType = 'qfq' | 'hfq' | 'bfq';

export interface AdjustedDailyRow {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
  adj_factor: number;
}

export interface AdjustedDailyResult {
  ts_code: string;
  adjust: AdjustType;
  count: number;
  rows: AdjustedDailyRow[];
}

const num = (v: unknown): number => Number(v ?? 0);
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const ymd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s: string): Date =>
  new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);

/** 把 {fields, items} 转成按字段名取值的一行对象数组（不依赖列顺序） */
function toRows(result: TushareResult): Record<string, string | number | null>[] {
  return result.items.map((item) => {
    const row: Record<string, string | number | null> = {};
    result.fields.forEach((f, i) => {
      row[f] = item[i] ?? null;
    });
    return row;
  });
}

/** trade_date → adj_factor */
function factorMap(result: TushareResult): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of toRows(result)) {
    const d = String(r.trade_date ?? '');
    if (d) map.set(d, Number(r.adj_factor ?? 1));
  }
  return map;
}

/** 区间内最新（trade_date 最大）的复权因子 */
function latestFactor(map: Map<string, number>): number {
  let latest = '';
  let v = 1;
  for (const [d, f] of map) {
    if (d > latest) {
      latest = d;
      v = f;
    }
  }
  return v;
}

/** 区间内最早（trade_date 最小）的复权因子 */
function earliestFactor(map: Map<string, number>): number {
  let earliest = '';
  let v = 1;
  for (const [d, f] of map) {
    if (!earliest || d < earliest) {
      earliest = d;
      v = f;
    }
  }
  return v;
}

/** 最新一期复权因子（前复权基准，取最近 60 天内最大 trade_date 的因子） */
async function getLatestAdjFactor(tsCode: string): Promise<number> {
  const today = ymd(new Date());
  const start = ymd(new Date(Date.now() - 60 * 86400000));
  const res = await tushareQuery('adj_factor', {
    ts_code: tsCode,
    start_date: start,
    end_date: today,
  });
  return latestFactor(factorMap(res));
}

/** 上市首日复权因子（后复权基准，用 stock_basic 的 list_date 定位） */
async function getListingAdjFactor(tsCode: string): Promise<number> {
  const basic = await tushareQuery('stock_basic', { ts_code: tsCode }, 'list_date');
  const listDate = String(basic.items[0]?.[0] ?? '');
  if (!listDate) return 1;
  const end = ymd(new Date(parseYmd(listDate).getTime() + 30 * 86400000));
  const res = await tushareQuery('adj_factor', {
    ts_code: tsCode,
    start_date: listDate,
    end_date: end,
  });
  return earliestFactor(factorMap(res));
}

/**
 * 获取个股复权日线：daily（未复权 OHLCV）+ adj_factor（复权因子）计算。
 * - qfq 前复权：价格 × adj_factor / 最新复权因子（最近交易日为基准）
 * - hfq 后复权：价格 × adj_factor / 上市首日复权因子
 * - bfq 不复权：原始价（仍附 adj_factor 供核对）
 * 仅 open/high/low/close 参与复权，pre_close/change/pct_chg/vol/amount 保留不复权原值。
 */
export async function getAdjustedDaily(
  tsCode: string,
  adjust: AdjustType,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<AdjustedDailyResult> {
  const today = ymd(new Date());
  const endDate = opts.endDate ?? today;
  const startDate = opts.startDate ?? ymd(new Date(Date.now() - 365 * 86400000));
  if (startDate > endDate) {
    throw new Error(`日期区间无效：start_date(${startDate}) 晚于 end_date(${endDate})`);
  }

  const daily = await tushareQuery('daily', {
    ts_code: tsCode,
    start_date: startDate,
    end_date: endDate,
  });
  const factors = await tushareQuery('adj_factor', {
    ts_code: tsCode,
    start_date: startDate,
    end_date: endDate,
  });
  const factorByDate = factorMap(factors);

  let baseFactor = 1;
  if (adjust === 'qfq') {
    // 区间已覆盖到今天时，最新因子即区间最大 trade_date 的因子；否则单独补取
    baseFactor = endDate >= today ? latestFactor(factorByDate) : await getLatestAdjFactor(tsCode);
  } else if (adjust === 'hfq') {
    baseFactor = await getListingAdjFactor(tsCode);
  }

  const rows: AdjustedDailyRow[] = toRows(daily)
    .map((r) => {
      const tradeDate = String(r.trade_date ?? '');
      const adjFactor = Number(factorByDate.get(tradeDate) ?? 1);
      const mult = adjust === 'bfq' ? 1 : adjFactor / baseFactor;
      return {
        trade_date: tradeDate,
        open: round4(num(r.open) * mult),
        high: round4(num(r.high) * mult),
        low: round4(num(r.low) * mult),
        close: round4(num(r.close) * mult),
        pre_close: num(r.pre_close),
        change: num(r.change),
        pct_chg: num(r.pct_chg),
        vol: num(r.vol),
        amount: num(r.amount),
        adj_factor: adjFactor,
      };
    })
    .sort((a, b) => (a.trade_date < b.trade_date ? -1 : 1));

  return { ts_code: tsCode, adjust, count: rows.length, rows };
}
