import type { AgentEvent, SavedFileInfo } from '@shared/types/agent';
import type { KeyMoveList } from '@shared/types/key-move';
import type { ChatMessage, ToolCallState } from '@/models/agent';
import type { AgentChatState } from './agentChatReducer';

/**
 * 定位「当前正在流式输出的那条消息」的下标。
 * 同 id 出现多次时取最后一条：assistant_message_start 总是把新消息追加在末尾，
 * 因此最后一条才是本轮的消息；早期版本存在跨轮同 id 的历史数据，用最后一条可避免
 * 把增量写进上一轮气泡。
 */
function lastIndexById(messages: ChatMessage[], id: string): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].id === id) return i;
  }
  return -1;
}

/** 把缓存的文件 / 关键行情合并到最后一个 assistant 消息上 */
function flushIntoLastAssistant(
  messages: ChatMessage[],
  files: SavedFileInfo[],
  keyMoves: KeyMoveList[],
): ChatMessage[] {
  if (!files.length && !keyMoves.length) return messages;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return messages;
  return messages.map((m) =>
    m.id === lastAssistant.id
      ? {
          ...m,
          files: files.length ? [...(m.files ?? []), ...files] : m.files,
          keyMoves: keyMoves.length ? [...(m.keyMoves ?? []), ...keyMoves] : m.keyMoves,
        }
      : m,
  );
}

/** 处理主进程推送的 Agent 事件，返回新的聊天状态 */
export function applyAgentEvent(state: AgentChatState, e: AgentEvent): AgentChatState {
  switch (e.type) {
    case 'run_start':
      return { ...state, running: true, pendingFiles: [], pendingKeyMoves: [] };
    case 'run_end': {
      const messages = flushIntoLastAssistant(
        state.messages,
        state.pendingFiles,
        state.pendingKeyMoves,
      );
      return { ...state, running: false, pendingFiles: [], pendingKeyMoves: [], messages };
    }
    case 'assistant_message_start': {
      const message: ChatMessage = {
        id: e.messageId,
        role: 'assistant',
        text: '',
        thinking: '',
        tools: [],
        toolsExpanded: false,
        done: false,
      };
      return { ...state, messages: [...state.messages, message] };
    }
    case 'assistant_text_delta': {
      const idx = lastIndexById(state.messages, e.messageId);
      const hadText = idx >= 0 && state.messages[idx].text.length > 0;
      return {
        ...state,
        messages: state.messages.map((m, i) => {
          if (i === idx) {
            const next = { ...m, text: m.text + e.text };
            // 工具与正文同一条消息：首次正文时收起自身工具
            if (!hadText && m.tools && m.tools.length > 0) {
              next.toolsExpanded = false;
              next.tools = m.tools.map((t) => ({ ...t, expanded: false }));
            }
            return next;
          }
          // 工具在之前的消息：首次正文时收起前面的工具
          if (!hadText && i < idx && m.tools && m.tools.length > 0) {
            return {
              ...m,
              toolsExpanded: false,
              tools: m.tools.map((t) => ({ ...t, expanded: false })),
            };
          }
          return m;
        }),
      };
    }
    case 'assistant_thinking_delta': {
      const idx = lastIndexById(state.messages, e.messageId);
      if (idx < 0) return state;
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === idx ? { ...m, thinking: (m.thinking ?? '') + e.text } : m,
        ),
      };
    }
    case 'assistant_message_end': {
      const idx = lastIndexById(state.messages, e.messageId);
      if (idx < 0) return state;
      return {
        ...state,
        messages: state.messages.map((m, i) => (i === idx ? { ...m, done: true } : m)),
      };
    }
    case 'tool_start': {
      const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant) return state;
      const tool: ToolCallState = {
        id: e.toolCallId,
        name: e.toolName,
        label: e.label,
        args: e.args,
        status: 'running',
        outputText: '',
        expanded: true,
      };
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === lastAssistant.id
            ? { ...m, toolsExpanded: true, tools: [...(m.tools ?? []), tool] }
            : m,
        ),
      };
    }
    case 'tool_update':
      return {
        ...state,
        messages: state.messages.map((m) => ({
          ...m,
          tools: m.tools?.map((t) =>
            t.id === e.toolCallId ? { ...t, outputText: e.outputText ?? t.outputText } : t,
          ),
        })),
      };
    case 'tool_end':
      return {
        ...state,
        messages: state.messages.map((m) => ({
          ...m,
          tools: m.tools?.map((t) =>
            t.id === e.toolCallId
              ? {
                  ...t,
                  status: e.isError ? 'error' : 'done',
                  outputText: e.outputText ?? t.outputText,
                }
              : t,
          ),
        })),
      };
    case 'file_saved':
      return { ...state, pendingFiles: [...state.pendingFiles, e.file] };
    case 'key_moves':
      return {
        ...state,
        pendingKeyMoves: [...state.pendingKeyMoves, { security: e.security, items: e.items }],
      };
    case 'error': {
      const messages = flushIntoLastAssistant(
        state.messages,
        state.pendingFiles,
        state.pendingKeyMoves,
      );
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'error',
        text: e.message,
        done: true,
      };
      return {
        ...state,
        running: false,
        pendingFiles: [],
        pendingKeyMoves: [],
        messages: [...messages, errorMessage],
      };
    }
    default:
      return state;
  }
}
