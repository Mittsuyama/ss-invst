import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/models/agent';
import { applyAgentEvent } from './applyAgentEvent';
import { agentChatReducer, createInitialAgentChatState } from './agentChatReducer';

const user = (id: string, text: string): ChatMessage => ({
  id,
  role: 'user',
  text,
  done: true,
});

const assistant = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role: 'assistant',
  text: '',
  thinking: '',
  tools: [],
  toolsExpanded: false,
  done: false,
  ...extra,
});

/** 模拟一轮完整的 assistant 流：start → thinking → text → end */
function runAssistant(
  state: ReturnType<typeof createInitialAgentChatState>,
  id: string,
  t: string,
  a: string,
) {
  let next = applyAgentEvent(state, { type: 'assistant_message_start', messageId: id });
  next = applyAgentEvent(next, { type: 'assistant_thinking_delta', messageId: id, text: t });
  next = applyAgentEvent(next, { type: 'assistant_text_delta', messageId: id, text: a });
  next = applyAgentEvent(next, { type: 'assistant_message_end', messageId: id });
  return next;
}

describe('applyAgentEvent：assistant 增量只落在本轮消息上', () => {
  it('同 id 重复时，text / thinking 只追加到最后一条', () => {
    const state = createInitialAgentChatState([
      user('u-1', 'q1'),
      assistant('a1', { text: 'a1', thinking: 't1', done: true }),
      user('u-2', 'q2'),
      assistant('a1'),
    ]);

    const withText = applyAgentEvent(state, {
      type: 'assistant_text_delta',
      messageId: 'a1',
      text: 'a2',
    });
    expect(withText.messages[1].text).toBe('a1');
    expect(withText.messages[3].text).toBe('a2');

    const withThinking = applyAgentEvent(withText, {
      type: 'assistant_thinking_delta',
      messageId: 'a1',
      text: 't2',
    });
    expect(withThinking.messages[1].thinking).toBe('t1');
    expect(withThinking.messages[3].thinking).toBe('t2');
  });

  it('同 id 重复时，message_end 只标记最后一条 done', () => {
    const state = createInitialAgentChatState([
      assistant('a1', { text: '上一轮' }),
      user('u-2', 'q2'),
      assistant('a1', { text: '本轮' }),
    ]);

    const next = applyAgentEvent(state, { type: 'assistant_message_end', messageId: 'a1' });
    expect(next.messages[2].done).toBe(true);
    expect(next.messages[0].done).toBe(false);
  });

  it('id 会话内唯一时，两轮消息各自落在自己的气泡上', () => {
    let state = createInitialAgentChatState([]);

    state = agentChatReducer(state, { type: 'APPEND_USER', message: user('u-1', 'q1') });
    state = applyAgentEvent(state, { type: 'run_start' });
    state = runAssistant(state, 'a1', 't1', '答案一');
    state = applyAgentEvent(state, { type: 'run_end' });

    state = agentChatReducer(state, { type: 'APPEND_USER', message: user('u-2', 'q2') });
    state = applyAgentEvent(state, { type: 'run_start' });
    state = runAssistant(state, 'a2', 't2', '答案二');
    state = applyAgentEvent(state, { type: 'run_end' });

    expect(state.messages.map((m) => m.id)).toEqual(['u-1', 'a1', 'u-2', 'a2']);
    expect(state.messages[1]).toMatchObject({ text: '答案一', thinking: 't1', done: true });
    expect(state.messages[3]).toMatchObject({ text: '答案二', thinking: 't2', done: true });
    expect(state.running).toBe(false);
  });
});
