import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getFinancialStatements } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetFinancialStatementsTool(Type: PiType): AgentTool {
  return {
    name: 'get_financial_statements',
    label: '财务报表',
    description:
      '[eastmoney] 获取公司近 N 年的资产负债表、利润表、现金流量表及关键领先指标（毛利率/净利率/扣非ROE/周转天数等），字段已转为中文。用于价值投资与基本面分析。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      years: Type.Optional(Type.Integer({ default: 5, minimum: 1, maximum: 10 })),
    }),
    execute: async (_id, params) => {
      const { secid, years } = params as { secid: string; years?: number };
      const reports = await getFinancialStatements(secid, years ?? 5);
      return ok({ count: reports.length }, reports, 200000);
    },
  };
}
