import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getBusiness } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createGetBusinessTool(Type: PiType): AgentTool {
  return {
    name: 'get_business',
    label: '主营构成',
    description: '获取公司最新年报的主营业务构成（按产品/行业的收入、占比、毛利率）。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
    }),
    execute: async (_id, params) => {
      const { secid } = params as { secid: string };
      const biz = await getBusiness(secid);
      return ok({ year: biz.year }, biz);
    },
  };
}
