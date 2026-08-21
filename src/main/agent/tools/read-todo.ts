import type { AgentTool } from '@earendil-works/pi-agent-core';
import { readTodo } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createReadTodoTool(Type: PiType): AgentTool {
  return {
    name: 'read_todo',
    label: '读取任务清单',
    description:
      '读取当前会话的任务清单（todo.md）。当上下文被压缩、或不确定当前进度时，用它重新读取任务状态，再继续执行。',
    parameters: Type.Object({}),
    execute: async () => {
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话');
      }
      const items = readTodo(sessionRuntime.workspacePath, sessionRuntime.sessionId);
      const text = items.length
        ? items
            .map((t) => {
              const mark = t.status === 'done' ? 'x' : t.status === 'in_progress' ? '~' : ' ';
              return `- [${mark}] ${t.title}`;
            })
            .join('\n')
        : '（暂无任务清单）';
      return ok({ count: items.length }, text);
    },
  };
}
