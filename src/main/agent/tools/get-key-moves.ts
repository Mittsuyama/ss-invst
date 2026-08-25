import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent } from '@shared/types/agent';
import { getKeyMoves } from '../data/key-moves';
import { sessionRuntime } from '../session/session-runtime';
import { appendKeyMoves } from '../session/session-store';
import { ok, type PiType } from './common';

export function createGetKeyMovesTool(Type: PiType, emit: (e: AgentEvent) => void): AgentTool {
  return {
    name: 'get_key_moves',
    label: '关键行情区间',
    description:
      '[复合：eastmoney 日K + 本地计算] 识别某只股票历史上的关键行情区间（一段主升浪或大幅下跌）：先找日K峰值谷值（前后各20根共41根K线里的最高点/最低点），再连接相邻峰谷计算每段涨跌幅，取幅度最大的前50%作为关键区间。返回每段的起止日期、起止价与总涨跌幅（不含K线明细）。入参 query 可为股票名称、代码、拼音或 secid（如 贵州茅台 / 600519 / gzmt / 1.600519），内部会经东财搜索归一化为东财 secid。',
    parameters: Type.Object({
      query: Type.String({
        description: '股票名称、代码、拼音或 secid，如 贵州茅台 / 600519 / gzmt / 1.600519',
      }),
    }),
    execute: async (_id, params) => {
      const { query } = params as { query: string };
      const { security, items } = await getKeyMoves(query);

      // 持久化（按 toolCallId 去重，重开会话可还原气泡卡片；失败不影响本次结果）
      if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
        try {
          appendKeyMoves(sessionRuntime.workspacePath, sessionRuntime.sessionId, {
            toolCallId: _id,
            security,
            items,
          });
        } catch {
          // 忽略持久化失败
        }
      }

      emit({ type: 'key_moves', security, items });

      return ok(
        { name: security.name, code: security.code, count: items.length },
        { security, items },
      );
    },
  };
}
