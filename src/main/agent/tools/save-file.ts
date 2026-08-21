import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import { saveSessionFile } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createSaveFileTool(Type: PiType, emit: (e: AgentEvent) => void): AgentTool {
  const Dir = Type.Union([
    Type.Literal('files'),
    Type.Literal('output'),
    Type.Literal('intermediate'),
  ]);

  return {
    name: 'save_file',
    label: '保存文件',
    description:
      '把文本内容保存为文件到当前会话。filename 是文件名（如 2024-report.md），content 是文件内容，dir 决定保存到哪个目录：files（通用，默认）、output（skill 最终报告）、intermediate（skill 中间产物）。返回保存后的绝对路径。',
    parameters: Type.Object({
      filename: Type.String({ description: '文件名，如 2024-report.md' }),
      content: Type.String({ description: '文件内容（Markdown 等）' }),
      dir: Type.Optional(Dir),
    }),
    execute: async (_id, params) => {
      const { filename, content, dir } = params as {
        filename: string;
        content: string;
        dir?: 'files' | 'output' | 'intermediate';
      };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法保存文件');
      }
      const targetDir = dir ?? 'files';
      const savedPath = saveSessionFile(
        sessionRuntime.workspacePath,
        sessionRuntime.sessionId,
        filename,
        content,
        targetDir,
      );
      emit({ type: 'file_saved', file: { name: filename, path: savedPath, dir: targetDir } });
      return ok({ path: savedPath }, { path: savedPath, filename, dir: targetDir });
    },
  };
}
