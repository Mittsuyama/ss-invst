import { memo, useCallback, useEffect, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { SessionTree } from '@/components/SessionTree';
import { AgentChat } from '@/components/AgentChat';
import { RightPanel } from '@/components/RightPanel';
import {
  mapAgentMessages,
  appendDebugEvent,
  debugEventsAtom,
  type ChatMessage,
} from '@/models/agent';
import {
  currentWorkspaceAtom,
  currentSessionIdAtom,
  workspaceListAtom,
  workspaceSessionsAtom,
  expandedWorkspacesAtom,
  lastWorkspaceAtom,
} from '@/models/session';
import { todoAtom, decisionAtom } from '@/models/todo';
import { currentSkillAtom } from '@/models/skill';
import type { SessionMeta } from '@shared/types/session';

export const Agent = memo(() => {
  const [workspace, setWorkspace] = useAtom(currentWorkspaceAtom);
  const [sessionId, setSessionId] = useAtom(currentSessionIdAtom);
  const [workspaceList, setWorkspaceList] = useAtom(workspaceListAtom);
  const [workspaceSessions, setWorkspaceSessions] = useAtom(workspaceSessionsAtom);
  const [expandedWorkspaces, setExpandedWorkspaces] = useAtom(expandedWorkspacesAtom);
  const [lastWorkspace, setLastWorkspace] = useAtom(lastWorkspaceAtom);
  const [, setDebugEvents] = useAtom(debugEventsAtom);
  const setTodo = useSetAtom(todoAtom);
  const setDecision = useSetAtom(decisionAtom);
  const setCurrentSkill = useSetAtom(currentSkillAtom);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionKey, setSessionKey] = useState(0);
  const [rightOpen, setRightOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const bump = useCallback(() => setSessionKey((k) => k + 1), []);

  /** 清空会话级投影状态（待办/决策/当前 skill），随后由主进程初始投影事件重新填充 */
  const clearSessionState = useCallback(() => {
    setTodo([]);
    setDecision([]);
    setCurrentSkill(null);
  }, [setTodo, setDecision, setCurrentSkill]);

  const loadWorkspaceSessions = useCallback(
    async (ws: string) => {
      const list = await window.session.list(ws);
      setWorkspaceSessions((prev) => ({ ...prev, [ws]: list }));
      return list;
    },
    [setWorkspaceSessions],
  );

  const loadSessionIntoChat = useCallback(async (ws: string, id: string) => {
    const snap = await window.session.load(ws, id);
    setChatMessages(mapAgentMessages(snap.messages, ws, id, snap.keyMoves ?? []));
  }, []);

  // 订阅调试事件 + 会话投影事件（待办/决策/当前 skill）
  useEffect(() => {
    const unsub = window.agent.onEvent((e) => {
      appendDebugEvent(setDebugEvents, e);
      switch (e.type) {
        case 'todo_update':
          setTodo(e.items);
          break;
        case 'decision_update':
          setDecision((prev) => [...prev, e.entry]);
          break;
        case 'skill_applied':
          setCurrentSkill(e.name ? { name: e.name, description: e.description } : null);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, [setDebugEvents, setTodo, setDecision, setCurrentSkill]);

  // 启动时：加载所有 workspace 的会话并自动回到上次
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wsList = workspaceList;
      if (!wsList.length) return;
      const map: Record<string, SessionMeta[]> = {};
      for (const ws of wsList) {
        try {
          map[ws] = await window.session.list(ws);
        } catch {
          map[ws] = [];
        }
      }
      if (cancelled) return;
      setWorkspaceSessions(map);
      setExpandedWorkspaces(Object.fromEntries(wsList.map((w) => [w, true])));
      const targetWs = lastWorkspace && wsList.includes(lastWorkspace) ? lastWorkspace : wsList[0];
      if (targetWs) {
        setWorkspace(targetWs);
        const list = map[targetWs] ?? [];
        if (list.length) {
          setSessionId(list[0].id);
          await loadSessionIntoChat(targetWs, list[0].id);
          if (!cancelled) bump();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openWorkspace = useCallback(async () => {
    const path = await window.session.pickWorkspace();
    if (!path) return;
    clearSessionState();
    setWorkspaceList((prev) => [path, ...prev.filter((w) => w !== path)]);
    setExpandedWorkspaces((prev) => ({ ...prev, [path]: true }));
    const list = await loadWorkspaceSessions(path);
    setWorkspace(path);
    setLastWorkspace(path);
    if (list.length) {
      setSessionId(list[0].id);
      await loadSessionIntoChat(path, list[0].id);
      bump();
    } else {
      setSessionId('');
      setChatMessages([]);
      bump();
    }
  }, [
    bump,
    clearSessionState,
    loadSessionIntoChat,
    loadWorkspaceSessions,
    setLastWorkspace,
    setSessionId,
    setWorkspace,
    setWorkspaceList,
    setExpandedWorkspaces,
  ]);

  const toggleWorkspace = useCallback(
    async (ws: string) => {
      setExpandedWorkspaces((prev) => ({ ...prev, [ws]: !prev[ws] }));
      if (!workspaceSessions[ws]) {
        await loadWorkspaceSessions(ws);
      }
    },
    [loadWorkspaceSessions, setExpandedWorkspaces, workspaceSessions],
  );

  const removeWorkspace = useCallback(
    (ws: string) => {
      setWorkspaceList((prev) => prev.filter((w) => w !== ws));
      setWorkspaceSessions((prev) => {
        const next = { ...prev };
        delete next[ws];
        return next;
      });
      setExpandedWorkspaces((prev) => {
        const next = { ...prev };
        delete next[ws];
        return next;
      });
      if (ws === workspace) {
        clearSessionState();
        setWorkspace('');
        setSessionId('');
        setChatMessages([]);
        bump();
      }
    },
    [
      bump,
      clearSessionState,
      setExpandedWorkspaces,
      setSessionId,
      setWorkspace,
      setWorkspaceList,
      setWorkspaceSessions,
      workspace,
    ],
  );

  const newSession = useCallback(async () => {
    if (!workspace) return;
    const meta = await window.session.create(workspace);
    clearSessionState();
    setSessionId(meta.id);
    setChatMessages([]);
    bump();
    await loadWorkspaceSessions(workspace);
  }, [bump, clearSessionState, loadWorkspaceSessions, setSessionId, workspace]);

  const selectSession = useCallback(
    async (ws: string, id: string) => {
      if (ws === workspace && id === sessionId) return;
      clearSessionState();
      setWorkspace(ws);
      setSessionId(id);
      setLastWorkspace(ws);
      await loadSessionIntoChat(ws, id);
      bump();
    },
    [
      bump,
      clearSessionState,
      loadSessionIntoChat,
      sessionId,
      setLastWorkspace,
      setSessionId,
      setWorkspace,
      workspace,
    ],
  );

  const deleteSession = useCallback(
    async (ws: string, id: string) => {
      await window.session.delete(ws, id);
      const list = await loadWorkspaceSessions(ws);
      if (ws === workspace && id === sessionId) {
        clearSessionState();
        if (list.length) {
          setSessionId(list[0].id);
          await loadSessionIntoChat(ws, list[0].id);
          bump();
        } else {
          setSessionId('');
          setChatMessages([]);
          bump();
        }
      }
    },
    [
      bump,
      clearSessionState,
      loadSessionIntoChat,
      loadWorkspaceSessions,
      sessionId,
      setSessionId,
      workspace,
    ],
  );

  const clearSession = useCallback(async () => {
    if (!workspace || !sessionId) return;
    await window.session.clear(workspace, sessionId);
    clearSessionState();
    setChatMessages([]);
    bump();
    await loadWorkspaceSessions(workspace);
  }, [bump, clearSessionState, loadWorkspaceSessions, sessionId, workspace]);

  const onRunEnd = useCallback(() => {
    setRefreshTick((t) => t + 1);
    if (workspace) void loadWorkspaceSessions(workspace);
  }, [loadWorkspaceSessions, workspace]);

  return (
    <div className="w-full h-full flex">
      <SessionTree
        workspaceList={workspaceList}
        workspaceSessions={workspaceSessions}
        expandedWorkspaces={expandedWorkspaces}
        currentWorkspace={workspace}
        currentSessionId={sessionId}
        onOpenWorkspace={openWorkspace}
        onToggleWorkspace={toggleWorkspace}
        onRemoveWorkspace={removeWorkspace}
        onNewSession={newSession}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onClearSession={clearSession}
      />
      <div className="flex-1 min-w-0 flex">
        <div className="flex-1 min-w-0">
          <AgentChat
            key={sessionKey}
            initialMessages={chatMessages}
            hasSession={!!sessionId}
            onRunEnd={onRunEnd}
            onToggleRightPanel={() => setRightOpen((v) => !v)}
          />
        </div>
        <RightPanel
          open={rightOpen}
          workspacePath={workspace}
          sessionId={sessionId}
          refreshTick={refreshTick}
        />
      </div>
    </div>
  );
});

Agent.displayName = 'Agent';
