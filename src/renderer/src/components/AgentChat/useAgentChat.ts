import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { AgentAttachment, AgentProvider, SavedFileInfo } from '@shared/types/agent';
import type { ChatMessage } from '@/models/agent';
import { envAtom } from '@/models/detail';
import { currentSkillAtom, skillIndexAtom } from '@/models/skill';
import { agentChatReducer, createInitialAgentChatState } from './agentChatReducer';

export interface UseAgentChatOptions {
  initialMessages: ChatMessage[];
  hasSession: boolean;
  onRunEnd?: () => void;
}

/** AgentChat 的状态与副作用：消息流订阅、发送/停止、附件、滚动与 skill 选择 */
export function useAgentChat({ initialMessages, hasSession, onRunEnd }: UseAgentChatOptions) {
  const env = useAtomValue(envAtom);
  const currentSkill = useAtomValue(currentSkillAtom);
  const skillIndex = useAtomValue(skillIndexAtom);
  const setSkillIndex = useSetAtom(skillIndexAtom);

  const [state, dispatch] = useReducer(
    agentChatReducer,
    initialMessages,
    createInitialAgentChatState,
  );

  /** null = 本次会话尚未手动选过；'' = 明确选「无 skill」；字符串 = 选定的 skill 名 */
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<SavedFileInfo | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;

  // 加载 skill 索引（下拉数据源）
  useEffect(() => {
    void window.agent
      .listSkills()
      .then(setSkillIndex)
      .catch(() => setSkillIndex([]));
  }, [setSkillIndex]);

  // 订阅主进程推送的 Agent 事件
  useEffect(() => {
    const unsubscribe = window.agent.onEvent((e) => {
      dispatch({ type: 'EVENT', event: e });
      if (e.type === 'run_end') onRunEndRef.current?.();
    });
    return unsubscribe;
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // 仅当用户停在底部时才跟随滚动（避免展开工具/查看历史时被拉到底）
  useEffect(() => {
    const el = scrollRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || state.running || !hasSession) return;
    setInput('');
    const attached = attachments;
    setAttachments([]);

    dispatch({
      type: 'APPEND_USER',
      message: { id: `u-${Date.now()}`, role: 'user', text, attachments: attached, done: true },
    });
    try {
      await window.agent.prompt({
        config: {
          llm: {
            provider: (env.llmProvider as AgentProvider) || 'deepseek',
            model: env.llmModel || 'deepseek-chat',
            apiKey: env.llmApiKey || '',
            baseUrl: env.llmBaseUrl || '',
          },
          cookie: env.cookie || '',
          tushareToken: env.tushareToken || '',
        },
        text,
        attachments: attached,
        skill: pendingSkill === null ? undefined : pendingSkill || null,
      });
    } catch (e) {
      dispatch({
        type: 'APPEND_ERROR',
        message: {
          id: `err-${Date.now()}`,
          role: 'error',
          text: e instanceof Error ? e.message : String(e),
          done: true,
        },
      });
    }
  }, [input, state.running, hasSession, attachments, env, pendingSkill]);

  const onAttach = useCallback(async () => {
    try {
      const files = await window.agent.pickFiles();
      setAttachments((prev) => [...prev, ...files]);
    } catch {
      // 用户取消选择
    }
  }, []);

  const onAbort = useCallback(async () => {
    await window.agent.abort();
  }, []);

  const toggleTool = useCallback((messageId: string, toolId: string) => {
    dispatch({ type: 'TOGGLE_TOOL', messageId, toolId });
  }, []);

  const toggleToolsGroup = useCallback((messageId: string) => {
    dispatch({ type: 'TOGGLE_TOOLS_GROUP', messageId });
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((x) => x.path !== path));
  }, []);

  return {
    messages: state.messages,
    running: state.running,
    input,
    setInput,
    attachments,
    removeAttachment,
    previewFile,
    setPreviewFile,
    scrollRef,
    showScrollButton,
    onScroll,
    scrollToBottom,
    onSend,
    onAttach,
    onAbort,
    toggleTool,
    toggleToolsGroup,
    pendingSkill,
    setPendingSkill,
    currentSkill,
    skillIndex,
  };
}
