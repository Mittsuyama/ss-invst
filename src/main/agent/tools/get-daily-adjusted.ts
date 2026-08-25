import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getAdjustedDaily } from '../data/tushare';
import { secidToTsCode } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetDailyAdjustedTool(Type: PiType): AgentTool {
  return {
    name: 'get_daily_adjusted',
    label: '复权日线',
    description:
      '[tushare] 获取个股日线 K 线并按指定方式复权，只返回所选口径的一种结果：qfq 前复权（以最新复权因子为基准）、hfq 后复权（以上市首日复权因子为基准）、bfq 不复权（原始价）。数据来自 tushare daily（未复权 OHLCV）+ adj_factor（复权因子）计算。仅 open/high/low/close 参与复权，pre_close/change/pct_chg/vol/amount 保留不复权原值，每行附 adj_factor 供核对。用于需要精确复权价的技术分析、区间涨跌幅、回测。输入 secid（如 1.600519）与 adjust；可选 start_date/end_date（YYYYMMDD，缺省取近一年）。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      adjust: Type.Union([Type.Literal('qfq'), Type.Literal('hfq'), Type.Literal('bfq')]),
      start_date: Type.Optional(
        Type.String({ description: '开始日期 YYYYMMDD，如 20240101；缺省为近一年' }),
      ),
      end_date: Type.Optional(
        Type.String({ description: '结束日期 YYYYMMDD，如 20241231；缺省为今天' }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        secid: string;
        adjust: 'qfq' | 'hfq' | 'bfq';
        start_date?: string;
        end_date?: string;
      };
      const tsCode = secidToTsCode(p.secid);
      const result = await getAdjustedDaily(tsCode, p.adjust, {
        startDate: p.start_date,
        endDate: p.end_date,
      });
      return ok({ ts_code: tsCode, adjust: p.adjust, count: result.count }, result, 200000);
    },
  };
}
