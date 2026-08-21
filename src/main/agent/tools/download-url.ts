import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import { downloadUrl } from '../data/download';
import { writeUploadBytes } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createDownloadUrlTool(Type: PiType, emit: (e: AgentEvent) => void): AgentTool {
  return {
    name: 'download_url',
    label: '下载文件',
    description:
      '下载一个 URL 指向的文件（如年报 PDF）到当前会话的 uploads 目录，返回本地绝对路径。下载后可用 read_file 提取文本做进一步分析。',
    parameters: Type.Object({
      url: Type.String({ description: '文件 URL，如 https://.../annual-report.pdf' }),
    }),
    execute: async (_id, params) => {
      const { url } = params as { url: string };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法下载');
      }
      const { data, filename } = await downloadUrl(url);
      const savedPath = writeUploadBytes(
        sessionRuntime.workspacePath,
        sessionRuntime.sessionId,
        filename,
        data,
      );
      emit({ type: 'file_saved', file: { name: filename, path: savedPath, dir: 'uploads' } });
      return ok({ path: savedPath, filename }, { path: savedPath, filename, size: data.length });
    },
  };
}
