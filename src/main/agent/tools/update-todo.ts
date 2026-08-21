import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import type { TodoItem } from '@shared/types/session';
import { writeTodo } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createUpdateTodoTool(
  Type: PiType,
  emit: (e: AgentEvent) => void,
): AgentTool {
  const TodoStatus = Type.Union([
    Type.Literal('pending'),
    Type.Literal('in_progress'),
    Type.Literal('done'),
  ]);

  return {
    name: 'update_todo',
    label: '更新任务清单',
    description:
      '整体替换当前会话的任务清单（todo.md）。复杂多步任务（如下载年报、提取数据、生成报告）时用它规划与跟踪进度：开始前列出全部待办，做哪步就把哪步标为 in_progress，完成后标为 done，并及时更新。',
    parameters: Type.Object({
      todos: Type.Array(
        Type.Object({
          title: Type.String({ description: '任务标题' }),
          status: TodoStatus,
        }),
      ),
    }),
    execute: async (_id, params) => {
      const { todos } = params as { todos: TodoItem[] };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法保存任务清单');
      }
      const items = todos ?? [];
      writeTodo(sessionRuntime.workspacePath, sessionRuntime.sessionId, items);
      emit({ type: 'todo_update', items });
      return ok({ count: items.length }, { todos: items });
    },
  };
}
