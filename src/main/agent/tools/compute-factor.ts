import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getKlines } from '../data/eastmoney';
import { FACTORS, describeFactors, type FactorBar } from '../factors';
import { ok, type PiType } from './common';

export function createComputeFactorTool(Type: PiType): AgentTool {
  const PeriodEnum = Type.Union([Type.Literal('day'), Type.Literal('week'), Type.Literal('month')]);

  return {
    name: 'compute_factor',
    label: '计算因子信号',
    description: `[复合：eastmoney K线 + 本地计算] 拉取 K 线并用指定因子计算买卖点信号。可用因子：${describeFactors()}。period 可选 day/week/month，limit 是 K 线根数（默认 250），params 传该因子的参数（省略用默认值）。`,
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      factor: Type.String({ description: '因子名，如 macd_cross / ma_cross / rsi_reversal / boll_breakout' }),
      period: Type.Optional(PeriodEnum),
      limit: Type.Optional(Type.Integer({ default: 250, minimum: 30, maximum: 1000 })),
      params: Type.Optional(
        Type.Record(Type.String(), Type.Number(), { description: '因子参数，如 {short:5, long:20}' }),
      ),
    }),
    execute: async (_id, p) => {
      const args = p as {
        secid: string;
        factor: string;
        period?: 'day' | 'week' | 'month';
        limit?: number;
        params?: Record<string, number>;
      };
      const def = FACTORS[args.factor];
      if (!def) throw new Error(`未知因子 ${args.factor}，可用：${Object.keys(FACTORS).join(', ')}`);
      const { rows } = await getKlines(args.secid, args.period ?? 'day', args.limit ?? 250);
      const bars: FactorBar[] = rows.map((r) => ({ date: r.date, close: r.close, high: r.high, low: r.low }));
      const signals = def.fn(bars, args.params ?? {});
      const buyCount = signals.filter((s) => s.type === 'buy').length;
      const sellCount = signals.filter((s) => s.type === 'sell').length;
      return ok(
        { factor: args.factor, buyCount, sellCount },
        { factor: args.factor, signals },
        120000,
      );
    },
  };
}
