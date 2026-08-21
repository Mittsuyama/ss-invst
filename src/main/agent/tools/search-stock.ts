import type { AgentTool } from '@earendil-works/pi-agent-core';
import { searchSecurities } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createSearchStockTool(Type: PiType): AgentTool {
  return {
    name: 'search_stock',
    label: '搜索股票',
    description:
      '按股票名称、代码或拼音首字母搜索 A 股证券，返回候选列表（含 id/代码/名称/交易所）。在拉取任何股票数据前，先用它确定 secid。',
    parameters: Type.Object({
      keyword: Type.String({ description: '股票名称、代码或拼音，如 贵州茅台 / 600519 / gzmt' }),
    }),
    execute: async (_id, params) => {
      const { keyword } = params as { keyword: string };
      const list = await searchSecurities(keyword);
      return ok({ count: list.length }, list);
    },
  };
}
