import type { AgentTool } from '@earendil-works/pi-agent-core';
import { tushareQuery } from '../data/tushare';
import { ok, type PiType } from './common';

export function createTushareQueryTool(Type: PiType): AgentTool {
  return {
    name: 'tushare_query',
    label: 'Tushare 数据',
    description:
      '调用 Tushare 通用接口获取补充数据。常用 api_name：daily（日线）、daily_basic（每日指标：市值/PE/PB/换手率）、income（利润表）、balancesheet（资产负债表）、cashflow（现金流量表）、fina_indicator（财务指标：ROE/毛利率等）、dividend（分红）、stock_basic（股票列表）。params 传接口参数（如 ts_code、start_date、end_date），fields 传需要的字段（逗号分隔，可留空取全部）。',
    parameters: Type.Object({
      api_name: Type.String({
        description: 'Tushare 接口名，如 daily_basic / fina_indicator / income',
      }),
      params: Type.Record(Type.String(), Type.Unknown(), { description: '接口参数对象' }),
      fields: Type.Optional(Type.String({ description: '需要的字段，逗号分隔' })),
    }),
    execute: async (_id, params) => {
      const p = params as { api_name: string; params?: Record<string, unknown>; fields?: string };
      const result = await tushareQuery(p.api_name, p.params ?? {}, p.fields);
      return ok({ rowCount: result.rowCount, fields: result.fields }, result, 200000);
    },
  };
}
