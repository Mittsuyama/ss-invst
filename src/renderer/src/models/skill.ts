import { atom } from 'jotai';
import type { SkillInfo } from '@shared/types/agent';

/** 可用的运行时 skill 索引（list_skills 结果，下拉数据源） */
export const skillIndexAtom = atom<SkillInfo[]>([]);

/** 当前选定的 skill（来自 skill_applied 事件 / 会话加载恢复） */
export const currentSkillAtom = atom<{ name: string; description?: string } | null>(null);
