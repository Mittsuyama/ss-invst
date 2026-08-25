import type { AgentEvent, SavedFileInfo } from '@shared/types/agent';
import type { KeyMoveList } from '@shared/types/key-move';
import type { ChatMessage } from '@/models/agent';
import { applyAgentEvent } from './applyAgentEvent';

/** AgentChat 的聊天状态（messages 是唯一数据源，其余为运行期缓存） */
export interface AgentChatState {
  messages: ChatMessage[];
  running: boolean;
  /** 本轮 file_saved 缓存，run_end / error 时一次性挂到最后一条 assistant 消息 */
  pendingFiles: SavedFileInfo[];
  /** 本轮 key_moves 缓存，同上 */
  pendingKeyMoves: KeyMoveList[];
}

export type AgentChatAction =
  | { type: 'EVENT'; event: AgentEvent }
  | { type: 'APPEND_USER'; message: ChatMessage }
  | { type: 'APPEND_ERROR'; message: ChatMessage }
  | { type: 'TOGGLE_TOOL'; messageId: string; toolId: string }
  | { type: 'TOGGLE_TOOLS_GROUP'; messageId: string };

export function createInitialAgentChatState(messages: ChatMessage[]): AgentChatState {
  return { messages, running: false, pendingFiles: [], pendingKeyMoves: [] };
}

export function agentChatReducer(state: AgentChatState, action: AgentChatAction): AgentChatState {
  switch (action.type) {
    case 'EVENT':
      return applyAgentEvent(state, action.event);
    case 'APPEND_USER':
      return { ...state, running: true, messages: [...state.messages, action.message] };
    case 'APPEND_ERROR':
      return { ...state, running: false, messages: [...state.messages, action.message] };
    case 'TOGGLE_TOOL':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? {
                ...m,
                tools: m.tools?.map((t) =>
                  t.id === action.toolId ? { ...t, expanded: !t.expanded } : t,
                ),
              }
            : m,
        ),
      };
    case 'TOGGLE_TOOLS_GROUP':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId ? { ...m, toolsExpanded: !m.toolsExpanded } : m,
        ),
      };
    default:
      return state;
  }
}
