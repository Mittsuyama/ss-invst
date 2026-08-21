import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getQuote } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetQuoteTool(Type: PiType): AgentTool {
  return {
    name: 'get_quote',
    label: '行情快照',
    description:
      '获取个股实时行情与估值快照：最新价、涨跌幅、市盈率TTM、市净率、总市值、换手率、上市日期、所属行业等。',
    parameters: Type.Object({
      secid: Type.String({
        description: '股票 id，格式「市场号.代码」，如 1.600519（1=上交所 0=深交所）',
      }),
    }),
    execute: async (_id, params) => {
      const { secid } = params as { secid: string };
      const quote = await getQuote(secid);
      return ok({ code: quote.code, name: quote.name }, quote);
    },
  };
}
