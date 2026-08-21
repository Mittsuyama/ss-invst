import { atom } from 'jotai';
import type { TodoItem } from '@shared/types/session';

/** 当前会话的任务清单（来自 todo_update 事件） */
export const todoAtom = atom<TodoItem[]>([]);

export interface DecisionEntry {
  time: string;
  decision: string;
  reason?: string;
}

/** 当前会话的决策日志（来自 decision_update 事件，append-only） */
export const decisionAtom = atom<DecisionEntry[]>([]);
