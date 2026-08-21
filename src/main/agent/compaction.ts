import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { Model } from '@earendil-works/pi-ai';

type PiCore = typeof import('@earendil-works/pi-agent-core');

/** 为摘要输出 + 后续回复预留的 token 数 */
const RESERVE_TOKENS = 4096;
/** 压缩后保留的最近上下文 token 预算 */
const KEEP_RECENT_TOKENS = 12000;

const SUMMARIZATION_CUSTOM_INSTRUCTIONS =
  '这是一次 A 股投资分析对话，请重点保留：股票代码/名称、关键财务数据与指标、分析结论、以及风险提示。';

export interface CompactDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  apiKey: string;
  core: PiCore;
  signal?: AbortSignal;
}

/**
 * 内存级上下文压缩兜底：当上下文接近模型窗口上限时，
 * 把早期消息压成一段摘要 + 保留最近消息，避免超出上下文窗口。
 * 注意：只影响本次喂给 LLM 的上下文，不修改 agent.state.messages（磁盘历史仍保留全量）。
 */
export async function compactContext(
  messages: AgentMessage[],
  deps: CompactDeps,
): Promise<AgentMessage[]> {
  const { model, apiKey, core, signal } = deps;
  const contextWindow = model.contextWindow ?? 128000;
  const settings = {
    enabled: true,
    reserveTokens: RESERVE_TOKENS,
    keepRecentTokens: KEEP_RECENT_TOKENS,
  };

  const estimate = core.estimateContextTokens(messages);
  if (!core.shouldCompact(estimate.tokens, contextWindow, settings)) {
    return messages;
  }

  const cutIndex = findCutPoint(messages, core);
  const toSummarize = messages.slice(0, cutIndex);
  const kept = messages.slice(cutIndex);
  if (toSummarize.length === 0) return messages;

  try {
    const result = await core.generateSummary(
      toSummarize,
      model,
      RESERVE_TOKENS,
      apiKey,
      undefined,
      signal,
      SUMMARIZATION_CUSTOM_INSTRUCTIONS,
    );
    if (result.ok && result.value) {
      const summaryMessage: AgentMessage = {
        role: 'user',
        content: `[历史摘要] 以下是本次会话较早内容的压缩摘要：\n\n${result.value}`,
        timestamp: Date.now(),
      };
      return [summaryMessage, ...kept];
    }
  } catch {
    // 摘要失败，退回截断
  }

  // 摘要失败：退化为直接截断，只保留最近消息
  return kept;
}

/** 从后往前找最近的用户消息作为干净切点，保证不把一轮对话拦腰截断 */
function findCutPoint(messages: AgentMessage[], core: PiCore): number {
  let acc = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    acc += core.estimateTokens(messages[i]);
    if (messages[i].role === 'user' && acc >= KEEP_RECENT_TOKENS) {
      return i;
    }
  }
  // 找不到干净的用户消息切点，退回保留后 1/4
  return Math.max(1, Math.floor(messages.length * 0.75));
}
