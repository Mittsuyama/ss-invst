import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getKlines } from '../data/eastmoney';
import { FACTORS, describeFactors, type FactorBar } from '../factors';
import { evaluateSignals } from '../factors/backtest';
import { ok, type PiType } from './common';

export function createAnalyzeFactorTool(Type: PiType): AgentTool {
  const PeriodEnum = Type.Union([Type.Literal('day'), Type.Literal('week'), Type.Literal('month')]);

  return {
    name: 'analyze_factor',
    label: '因子回测统计',
    description: `拉取 K 线，用指定因子产生买卖信号并做事件回测，返回胜率、赔率（profit factor）、平均盈亏、交易明细等统计，用于研究因子有效性。可用因子：${describeFactors()}。holdBars 是买入后最长持有根数（默认 20）。`,
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      factor: Type.String({ description: '因子名' }),
      period: Type.Optional(PeriodEnum),
      limit: Type.Optional(Type.Integer({ default: 250, minimum: 60, maximum: 2000 })),
      params: Type.Optional(Type.Record(Type.String(), Type.Number())),
      holdBars: Type.Optional(Type.Integer({ default: 20, minimum: 1, maximum: 120 })),
    }),
    execute: async (_id, p) => {
      const args = p as {
        secid: string;
        factor: string;
        period?: 'day' | 'week' | 'month';
        limit?: number;
        params?: Record<string, number>;
        holdBars?: number;
      };
      const def = FACTORS[args.factor];
      if (!def)
        throw new Error(`未知因子 ${args.factor}，可用：${Object.keys(FACTORS).join(', ')}`);
      const { rows } = await getKlines(args.secid, args.period ?? 'day', args.limit ?? 250);
      const bars: FactorBar[] = rows.map((r) => ({
        date: r.date,
        close: r.close,
        high: r.high,
        low: r.low,
      }));
      const signals = def.fn(bars, args.params ?? {});
      const { stats, trades } = evaluateSignals(bars, signals, args.holdBars ?? 20);
      return ok({ factor: args.factor, ...stats }, { factor: args.factor, stats, trades }, 120000);
    },
  };
}
