import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SessionMeta } from '@shared/types/session';

/** 当前 workspace 的绝对路径（空 = 未打开） */
export const currentWorkspaceAtom = atom('');
/** 当前会话 id（空 = 未选中） */
export const currentSessionIdAtom = atom('');
/** 最近打开的 workspace 列表（localStorage 持久化，树的一级节点） */
export const workspaceListAtom = atomWithStorage<string[]>('workspace-list', []);
/** 每个 workspace 的会话列表 */
export const workspaceSessionsAtom = atom<Record<string, SessionMeta[]>>({});
/** 树里展开的 workspace 集合 */
export const expandedWorkspacesAtom = atom<Record<string, boolean>>({});
/** 上次激活的 workspace（重启后自动回到） */
export const lastWorkspaceAtom = atomWithStorage<string>('last-workspace-path', '');
