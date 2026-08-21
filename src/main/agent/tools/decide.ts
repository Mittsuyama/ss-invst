import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import { appendDecision } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

export function createDecideTool(Type: PiType, emit: (e: AgentEvent) => void): AgentTool {
  return {
    name: 'decide',
    label: '记录决策',
    description:
      '追加一条决策到当前会话的 task.md 决策日志（记录「为什么这么选」）。执行前用它记下方案选择与理由，便于上下文压缩后恢复决策脉络。',
    parameters: Type.Object({
      decision: Type.String({ description: '决策内容' }),
      reason: Type.Optional(Type.String({ description: '决策理由' })),
    }),
    execute: async (_id, params) => {
      const { decision, reason } = params as { decision: string; reason?: string };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法记录决策');
      }
      const entry = appendDecision(
        sessionRuntime.workspacePath,
        sessionRuntime.sessionId,
        decision,
        reason,
      );
      emit({ type: 'decision_update', entry });
      return ok({}, `已记录决策：${decision}`);
    },
  };
}
