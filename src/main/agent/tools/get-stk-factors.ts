import type { AgentTool } from '@earendil-works/pi-agent-core';
import { tushareQuery } from '../data/tushare';
import { secidToTsCode } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetStkFactorsTool(Type: PiType): AgentTool {
  return {
    name: 'get_stk_factors',
    label: '技术面因子',
    description:
      '[tushare] 获取股票每日技术面因子（tushare 专业版接口 stk_factor_pro）：覆盖全历史的量化技术因子，如均线、MACD、KDJ、RSI、BOLL 等，字段带 _bfq（不复权）/ _qfq（前复权）/ _hfq（后复权）口径。用于技术分析。输入 secid，可选 start_date/end_date（YYYYMMDD）限定区间，fields 指定需要的列（逗号分隔，留空取全部）。该接口为专业版，可能需要更高 Tushare 积分/权限。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      start_date: Type.Optional(Type.String({ description: '开始日期 YYYYMMDD，如 20240101' })),
      end_date: Type.Optional(Type.String({ description: '结束日期 YYYYMMDD，如 20241231' })),
      fields: Type.Optional(Type.String({ description: '需要的字段，逗号分隔；留空取全部' })),
    }),
    execute: async (_id, params) => {
      const p = params as {
        secid: string;
        start_date?: string;
        end_date?: string;
        fields?: string;
      };
      const tsCode = secidToTsCode(p.secid);
      const apiParams: Record<string, unknown> = { ts_code: tsCode };
      if (p.start_date) apiParams.start_date = p.start_date;
      if (p.end_date) apiParams.end_date = p.end_date;

      const result = await tushareQuery('stk_factor_pro', apiParams, p.fields);
      return ok(
        { ts_code: tsCode, rowCount: result.rowCount, fields: result.fields },
        result,
        200000,
      );
    },
  };
}
