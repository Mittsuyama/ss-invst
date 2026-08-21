import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getReportPdfs } from '../data/eastmoney';
import { ok, type PiType } from './common';

export function createListReportPdfsTool(Type: PiType): AgentTool {
  return {
    name: 'list_report_pdfs',
    label: '财报PDF列表',
    description:
      '获取个股原始财务报告的 PDF 列表（年报/半年报/一季报/三季报），返回年份、报告类型、审计意见、发布日期及下载标识 publish_situations。要下载某份 PDF 时，先用它拿到 publish_situations，再用 download_report_pdf 下载。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
    }),
    execute: async (_id, params) => {
      const { secid } = params as { secid: string };
      const items = await getReportPdfs(secid);
      return ok({ count: items.length }, { items });
    },
  };
}
