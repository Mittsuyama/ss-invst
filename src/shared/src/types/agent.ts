/**
 * 投资 Agent 的协议类型（主进程 <-> 渲染进程 IPC）
 */
import type { TodoItem } from './session';
import type { KeyMove, KeyMoveSecurity } from './key-move';

/** 支持的 LLM 提供商 */
export type AgentProvider = 'deepseek' | 'openai' | 'anthropic' | 'custom';

/** LLM 配置 */
export interface AgentLLMConfig {
  provider: AgentProvider;
  /** 模型 id，如 deepseek-chat / gpt-4o-mini / claude-sonnet-4-5 / 自定义模型名 */
  model: string;
  /** API Key，为空时尝试从环境变量读取 */
  apiKey: string;
  /** 自定义 OpenAI 兼容接口的 baseUrl（仅 provider=custom 时使用） */
  baseUrl?: string;
}

/** Agent 运行时配置（渲染进程每次调用时携带） */
export interface AgentRuntimeConfig {
  llm: AgentLLMConfig;
  /** 东方财富 Cookie */
  cookie: string;
  /** Tushare Token */
  tushareToken: string;
}

/** 用户附加的文件（由主进程读取后返回） */
export interface AgentAttachment {
  name: string;
  path: string;
  type: 'pdf' | 'text' | 'other';
  size: number;
  /** 提取出的文本（PDF/文本文件） */
  text?: string;
  /** 用于 UI 预览的前若干字符 */
  preview?: string;
  /** 读取失败时的错误信息 */
  error?: string;
}

/** 运行时 skill 的索引条目（list_skills / UI 下拉数据源） */
export interface SkillInfo {
  name: string;
  description: string;
  params?: { key: string; desc: string }[];
  rootDir: string;
}

/** 保存/下载文件工具产出的文件（推送给渲染进程，渲染成每轮对话底部的卡片） */
export interface SavedFileInfo {
  name: string;
  path: string;
  dir: 'files' | 'output' | 'intermediate' | 'uploads';
}

/** 发送给 Agent 的一次提问 */
export interface AgentPromptPayload {
  config: AgentRuntimeConfig;
  text: string;
  attachments: AgentAttachment[];
  /** 手动选定的 skill 名；null = 明确清空；undefined = 不改变当前 skill */
  skill?: string | null;
}

/** Agent 运行期间由主进程推送给渲染进程的事件 */
export type AgentEvent =
  | { type: 'run_start' }
  | { type: 'run_end' }
  | { type: 'assistant_message_start'; messageId: string }
  | { type: 'assistant_text_delta'; messageId: string; text: string }
  | { type: 'assistant_thinking_delta'; messageId: string; text: string }
  | { type: 'assistant_message_end'; messageId: string; stopReason?: string }
  | {
      type: 'tool_start';
      toolCallId: string;
      toolName: string;
      label: string;
      args: unknown;
    }
  | { type: 'tool_update'; toolCallId: string; outputText?: string }
  | {
      type: 'tool_end';
      toolCallId: string;
      toolName: string;
      isError: boolean;
      outputText?: string;
    }
  | { type: 'error'; message: string }
  | { type: 'todo_update'; items: TodoItem[] }
  | { type: 'decision_update'; entry: { time: string; decision: string; reason?: string } }
  | { type: 'skill_applied'; name: string | null; description?: string }
  | { type: 'file_saved'; file: SavedFileInfo }
  | { type: 'key_moves'; security: KeyMoveSecurity; items: KeyMove[] };

/** IPC channel 名称 */
export const AGENT_EVENT_CHANNEL = 'agent:event';
export const AGENT_PROMPT_CHANNEL = 'agent:prompt';
export const AGENT_ABORT_CHANNEL = 'agent:abort';
export const AGENT_RESET_CHANNEL = 'agent:reset';
export const AGENT_PICK_FILES_CHANNEL = 'agent:pick-files';
export const AGENT_LIST_SKILLS_CHANNEL = 'agent:list-skills';
