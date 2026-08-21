import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getKlines } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetKlinesTool(Type: PiType): AgentTool {
  const PeriodEnum = Type.Union([Type.Literal('day'), Type.Literal('week'), Type.Literal('month')]);

  return {
    name: 'get_klines',
    label: 'K线数据',
    description:
      '获取个股 K 线（日/周/月）的 OHLCV 基础行情数据：开/收/高/低、成交量、成交额、振幅、涨跌幅、换手率。用于技术分析。技术指标（均线/MACD/KDJ/RSI/BOLL 等）请用 get_stk_factors（tushare stk_factor_pro）。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      period: Type.Optional(PeriodEnum),
      limit: Type.Optional(Type.Integer({ default: 60, minimum: 10, maximum: 300 })),
    }),
    execute: async (_id, params) => {
      const p = params as { secid: string; period?: 'day' | 'week' | 'month'; limit?: number };
      const period = p.period ?? 'day';
      const limit = p.limit ?? 60;
      const { rows, summary } = await getKlines(p.secid, period, limit);
      return ok({ name: summary.name, count: rows.length }, { period, summary, rows }, 120000);
    },
  };
}
