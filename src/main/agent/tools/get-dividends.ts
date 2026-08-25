import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getDividends } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetDividendsTool(Type: PiType): AgentTool {
  return {
    name: 'get_dividends',
    label: '分红历史',
    description: '[eastmoney] 获取公司近年分红送股记录。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      years: Type.Optional(Type.Integer({ default: 5, minimum: 1, maximum: 20 })),
    }),
    execute: async (_id, params) => {
      const { secid, years } = params as { secid: string; years?: number };
      const list = await getDividends(secid, years ?? 5);
      return ok({ count: list.length }, list);
    },
  };
}
