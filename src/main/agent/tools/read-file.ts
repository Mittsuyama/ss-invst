import path from 'node:path';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { readFileText } from '../data/files';
import { resolveSkillPath } from '../skill/skill-registry';
import { getSessionDir } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

/** 三路径解析：绝对路径 > skill 相对路径 > session 相对路径 */
function resolvePath(input: string): string {
  if (path.isAbsolute(input)) return input;
  if (sessionRuntime.currentSkill) {
    const s = resolveSkillPath(sessionRuntime.currentSkill, input);
    if (s) return s;
  }
  if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
    return path.resolve(getSessionDir(sessionRuntime.workspacePath, sessionRuntime.sessionId), input);
  }
  return input;
}

export function createReadFileTool(Type: PiType): AgentTool {
  return {
    name: 'read_file',
    label: '读取文件',
    description:
      '读取文件的文本内容。支持 PDF（自动提取文字，如年报）、以及 txt/md/json/csv 等文本文件。path 可为绝对路径、当前 skill 内的相对路径（如 references/估值方法.md），或会话目录内的相对路径（如 task.md、output/2025-report.md）。',
    parameters: Type.Object({
      path: Type.String({ description: '文件绝对路径，或 skill/会话相对路径' }),
    }),
    execute: async (_id, params) => {
      const { path: input } = params as { path: string };
      const filePath = resolvePath(input);
      const result = await readFileText(filePath);
      return ok(
        { type: result.type, path: filePath },
        { type: result.type, text: result.text },
        120000,
      );
    },
  };
}
