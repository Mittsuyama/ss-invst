/**
 * Session 持久化相关类型（主进程 <-> 渲染进程）
 * 文件布局：{workspace}/.ss-invst/sessions/{id}/
 *   meta.json, messages.jsonl, task.md, todo.md, key-moves.json,
 *   intermediate/, output/, files/, uploads/
 */
import type { KeyMoveEntry } from './key-move';

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** 当前选定的 skill 名（空 = 未选定），重开会话时恢复 */
  currentSkill?: string;
}

/** 一个会话的完整快照（加载时返回给渲染进程） */
export interface SessionSnapshot {
  meta: SessionMeta;
  /** pi-agent 的 AgentMessage[]（JSON 序列化后的原始对象） */
  messages: unknown[];
  /** 会话内计算出的关键行情区间（按 toolCallId 关联消息，重开会话还原气泡卡片） */
  keyMoves?: KeyMoveEntry[];
}

/** 会话内文件信息 */
export interface SessionFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

/**
 * 会话文件列表。
 * uploads = 用户上传；files = 通用生成；
 * intermediate = skill 中间产物；output = skill 最终报告。
 */
export interface SessionFileList {
  uploads: SessionFileInfo[];
  files: SessionFileInfo[];
  intermediate: SessionFileInfo[];
  output: SessionFileInfo[];
}

/** 读取文本文件的结果（渲染进程预览用） */
export interface SessionReadFileResult {
  type: 'pdf' | 'text' | 'other';
  text: string;
}

/** 任务清单条目状态 */
export type TodoStatus = 'pending' | 'in_progress' | 'done';

export interface TodoItem {
  title: string;
  status: TodoStatus;
}

export const WORKSPACE_PICK_CHANNEL = 'workspace:pick';
export const SESSION_LIST_CHANNEL = 'session:list';
export const SESSION_CREATE_CHANNEL = 'session:create';
export const SESSION_LOAD_CHANNEL = 'session:load';
export const SESSION_DELETE_CHANNEL = 'session:delete';
export const SESSION_CLEAR_CHANNEL = 'session:clear';
export const SESSION_LIST_FILES_CHANNEL = 'session:list-files';
export const SESSION_OPEN_FILE_CHANNEL = 'session:open-file';
export const SESSION_READ_FILE_CHANNEL = 'session:read-file';
