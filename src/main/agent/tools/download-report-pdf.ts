import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import { getReportPdfs, getReportPdfUrl } from '../data/eastmoney';
import { downloadUrl } from '../data/download';
import { writeUploadBytes } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createDownloadReportPdfTool(
  Type: PiType,
  emit: (e: AgentEvent) => void,
): AgentTool {
  return {
    name: 'download_report_pdf',
    label: '下载财报PDF',
    description:
      '根据 list_report_pdfs 返回的 publish_situations 下载对应的原始财务报告 PDF 到会话 uploads 目录（如 2024 年报）。下载后可用 read_file 提取文字。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，如 1.600519' }),
      publish_situations: Type.String({
        description: '报告标识，来自 list_report_pdfs 返回的 publish_situations',
      }),
    }),
    execute: async (_id, params) => {
      const { secid, publish_situations } = params as {
        secid: string;
        publish_situations: string;
      };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法下载');
      }

      const item = (await getReportPdfs(secid)).find(
        (i) => i.publish_situations === publish_situations,
      );
      if (!item) {
        throw new Error(`未找到报告 ${publish_situations}，请先用 list_report_pdfs 获取列表`);
      }
      if (!item.published) {
        throw new Error(`该报告（${item.year} ${item.report_type}）尚未发布 PDF，无法下载`);
      }

      const url = await getReportPdfUrl(publish_situations);
      if (!url) {
        throw new Error(`未能获取 PDF 下载地址：${publish_situations}`);
      }

      const { data } = await downloadUrl(url);
      const filename = `${item.year}-${item.report_type}.pdf`;
      const savedPath = writeUploadBytes(
        sessionRuntime.workspacePath,
        sessionRuntime.sessionId,
        filename,
        data,
      );
      emit({ type: 'file_saved', file: { name: filename, path: savedPath, dir: 'uploads' } });
      return ok(
        { path: savedPath },
        { path: savedPath, filename, year: item.year, report_type: item.report_type },
      );
    },
  };
}
