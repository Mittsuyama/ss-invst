import { ipcMain, BrowserWindow, dialog, shell, type WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core';
import { loadPi } from './pi';
import {
  AGENT_EVENT_CHANNEL,
  AGENT_PROMPT_CHANNEL,
  AGENT_ABORT_CHANNEL,
  AGENT_RESET_CHANNEL,
  AGENT_PICK_FILES_CHANNEL,
  AGENT_LIST_SKILLS_CHANNEL,
  type AgentEvent,
  type AgentPromptPayload,
  type AgentAttachment,
} from '@shared/types/agent';
import {
  WORKSPACE_PICK_CHANNEL,
  SESSION_LIST_CHANNEL,
  SESSION_CREATE_CHANNEL,
  SESSION_LOAD_CHANNEL,
  SESSION_DELETE_CHANNEL,
  SESSION_CLEAR_CHANNEL,
  SESSION_LIST_FILES_CHANNEL,
  SESSION_OPEN_FILE_CHANNEL,
} from '@shared/types/session';
import {
  createSession,
  listSessions,
  loadSession,
  saveSession,
  clearSession,
  deleteSession,
  listSessionFiles,
  copyUploadFile,
  updateSessionSkill,
  readTodo,
} from './session/session-store';
import { sessionRuntime } from './session/session-runtime';
import { buildModel } from './models';
import { createTools } from './tools';
import { SYSTEM_PROMPT } from './system-prompt';
import { runtime } from './data/eastmoney';
import { readFileText } from './data/files';
import { compactContext } from './compaction';
import { listSkills, loadSkill } from './skill/skill-registry';

type AgentInstance = import('@earendil-works/pi-agent-core').Agent;

let tools: AgentTool[] = [];
const toolLabels: Record<string, string> = {};

let agent: AgentInstance | null = null;
/** ensureAgent 的在途 Promise（原子化懒初始化，避免并发下创建多个 Agent） */
let agentPromise: Promise<AgentInstance> | null = null;
let currentSender: WebContents | null = null;
let assistantCounter = 0;
let currentAssistantId: string | null = null;

// 完整 system prompt：基础 SYSTEM_PROMPT + 可选「当前技能」段（由 applySkill 拼接）
let resolvedSystemPrompt = SYSTEM_PROMPT;

// 会话状态
let savedMessageCount = 0;
// 当前 LLM API Key（供上下文压缩时调用摘要 LLM 使用）
let currentApiKey: string | undefined;

function emit(event: AgentEvent): void {
  if (!currentSender || currentSender.isDestroyed()) return;
  currentSender.send(AGENT_EVENT_CHANNEL, event);
}

/** 把 skill 的 SKILL.md 全文拼进 system prompt 独立段（保持主 prompt 短，切换只替换该段） */
function buildSystemPromptWithSkill(markdown: string): string {
  return `${SYSTEM_PROMPT}\n\n## 当前技能（skill）\n\n${markdown}`;
}

/**
 * 选定/清空当前 skill；返回 SKILL.md 全文（清空时 undefined）。找不到会 throw。
 * 供 use_skill 工具（自动路由）与 prompt payload.skill（手动路由）共同调用。
 */
function applySkill(name: string | undefined): string | undefined {
  if (!name) {
    resolvedSystemPrompt = SYSTEM_PROMPT;
    sessionRuntime.currentSkill = '';
    if (agent) agent.state.systemPrompt = resolvedSystemPrompt;
    if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
      try {
        updateSessionSkill(sessionRuntime.workspacePath, sessionRuntime.sessionId, '');
      } catch {
        // 持久化失败不影响流程
      }
    }
    emit({ type: 'skill_applied', name: null });
    return undefined;
  }

  const pkg = loadSkill(name);
  if (!pkg) throw new Error(`未找到 skill：${name}，请先用 list_skills 查看可用 skill`);
  resolvedSystemPrompt = buildSystemPromptWithSkill(pkg.markdown);
  sessionRuntime.currentSkill = name;
  if (agent) agent.state.systemPrompt = resolvedSystemPrompt;
  if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
    try {
      updateSessionSkill(sessionRuntime.workspacePath, sessionRuntime.sessionId, name);
    } catch {
      // 持久化失败不影响流程
    }
  }
  emit({ type: 'skill_applied', name, description: pkg.description });
  return pkg.markdown;
}

function contentToText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return (
    content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((block: any) => block?.type === 'text' && typeof block?.text === 'string')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((block: any) => block.text)
      .join('')
  );
}

/** 把 LLM 错误转成对用户友好的提示 */
function friendlyError(message: string): string {
  if (/api.?key|apikey|credential|401|unauthorized|missing/i.test(message)) {
    return `LLM 鉴权失败：${message}\n请检查右上角「设置环境变量」里的 LLM API Key 是否正确填写。`;
  }
  return message;
}

function providerEnvKey(provider: string | undefined): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'deepseek':
      return 'DEEPSEEK_API_KEY';
    default:
      return ''; // custom 可能不需要 key
  }
}

async function createAgent(): Promise<AgentInstance> {
  const { ai, core } = await loadPi();
  if (!tools.length) {
    tools = await createTools({ emit, applySkill });
    for (const tool of tools) toolLabels[tool.name] = tool.label;
  }

  const a = new core.Agent({
    initialState: {
      systemPrompt: resolvedSystemPrompt,
      model: buildModel({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '' }),
      tools,
    },
    streamFn: ai.streamSimple,
    toolExecution: 'parallel',
  });
  agent = a;

  // 上下文压缩兜底：仅在接近窗口上限时压缩早期历史
  a.transformContext = async (messages, signal) => {
    return compactContext(messages, {
      model: a.state.model,
      apiKey: currentApiKey ?? '',
      core,
      signal,
    });
  };

  a.subscribe(async (event) => {
    switch (event.type) {
      case 'agent_start':
        assistantCounter = 0;
        currentAssistantId = null;
        emit({ type: 'run_start' });
        break;
      case 'agent_end':
        currentAssistantId = null;
        await persistCurrentSession();
        emit({ type: 'run_end' });
        break;
      case 'message_start': {
        const msg = event.message as {
          role?: string;
          stopReason?: string;
          errorMessage?: string;
        };
        if (msg?.role === 'assistant') {
          // LLM 一开头就失败（如缺 API key）：不创建空的 assistant 气泡，直接推错误
          if (msg.stopReason === 'error') {
            emit({ type: 'error', message: friendlyError(msg.errorMessage || '请求失败') });
            currentAssistantId = null;
          } else {
            currentAssistantId = `a${++assistantCounter}`;
            emit({ type: 'assistant_message_start', messageId: currentAssistantId });
          }
        }
        break;
      }
      case 'message_update': {
        if (!currentAssistantId) break;
        const kind = event.assistantMessageEvent?.type;
        if (kind === 'text_delta' && typeof event.assistantMessageEvent.delta === 'string') {
          emit({
            type: 'assistant_text_delta',
            messageId: currentAssistantId,
            text: event.assistantMessageEvent.delta,
          });
        } else if (
          kind === 'thinking_delta' &&
          typeof event.assistantMessageEvent.delta === 'string'
        ) {
          emit({
            type: 'assistant_thinking_delta',
            messageId: currentAssistantId,
            text: event.assistantMessageEvent.delta,
          });
        }
        break;
      }
      case 'message_end': {
        const msg = event.message as {
          role?: string;
          stopReason?: string;
          errorMessage?: string;
        };
        if (msg?.role === 'assistant') {
          if (currentAssistantId) {
            emit({
              type: 'assistant_message_end',
              messageId: currentAssistantId,
              stopReason: msg.stopReason,
            });
          }
          // 流中途失败（如连接中断）：把错误也推给渲染层
          if (msg.stopReason === 'error') {
            emit({ type: 'error', message: friendlyError(msg.errorMessage || '请求失败') });
          }
        }
        break;
      }
      case 'tool_execution_start':
        emit({
          type: 'tool_start',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          label: toolLabels[event.toolName] ?? event.toolName,
          args: event.args,
        });
        break;
      case 'tool_execution_update':
        emit({
          type: 'tool_update',
          toolCallId: event.toolCallId,
          outputText: contentToText(event.partialResult?.content),
        });
        break;
      case 'tool_execution_end':
        emit({
          type: 'tool_end',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          isError: event.isError,
          outputText: contentToText(event.result?.content),
        });
        break;
      default:
        break;
    }
  });

  return a;
}

/** 原子化的懒初始化：并发调用只会创建一次 Agent，避免多实例/重复订阅导致卡死 */
async function ensureAgent(): Promise<AgentInstance> {
  if (agent) return agent;
  if (!agentPromise) {
    agentPromise = createAgent().catch((err) => {
      agentPromise = null;
      throw err;
    });
  }
  return agentPromise;
}

async function persistCurrentSession(): Promise<void> {
  if (!agent || !sessionRuntime.workspacePath || !sessionRuntime.sessionId) return;
  try {
    const result = saveSession(
      sessionRuntime.workspacePath,
      sessionRuntime.sessionId,
      agent.state.messages,
      savedMessageCount,
    );
    savedMessageCount = result.savedCount;
  } catch (e) {
    emit({ type: 'error', message: `会话保存失败：${e instanceof Error ? e.message : String(e)}` });
  }
}

function buildPromptText(payload: AgentPromptPayload): string {
  const parts: string[] = [];
  const attachments = payload.attachments ?? [];
  if (attachments.length) {
    parts.push(
      ...attachments.map((a) =>
        a.error
          ? `【附件：${a.name}】\n读取失败：${a.error}`
          : `【附件：${a.name}】\n${a.text ?? '(无文本内容)'}`,
      ),
    );
  }
  parts.push(payload.text);
  return parts.join('\n\n');
}

export const createAgentIpc = () => {
  resolvedSystemPrompt = SYSTEM_PROMPT;

  ipcMain.handle(AGENT_PROMPT_CHANNEL, async (event, payload: AgentPromptPayload) => {
    const a = await ensureAgent();
    currentSender = event.sender;

    if (!sessionRuntime.sessionId) {
      emit({ type: 'error', message: '请先在左侧打开 workspace 并新建或选择一个会话' });
      currentSender = null;
      return;
    }

    // 主动校验：LLM API Key 未配置时直接给出友好提示（避免等一轮请求失败）
    const llm = payload.config?.llm;
    const envVar = providerEnvKey(llm?.provider);
    if (!llm?.apiKey?.trim() && envVar && !process.env[envVar]) {
      emit({
        type: 'error',
        message: `未配置 LLM API Key（${llm.provider}）。请在右上角「设置环境变量」里填写 API Key，或设置 ${envVar} 环境变量。`,
      });
      currentSender = null;
      return;
    }

    runtime.cookie = payload.config?.cookie ?? '';
    runtime.tushareToken = payload.config?.tushareToken || process.env.TUSHARE_TOKEN || '';

    // 记录当前解析后的 API Key，供上下文压缩的摘要 LLM 使用
    currentApiKey = llm?.apiKey?.trim() || (envVar ? process.env[envVar] : undefined);

    a.getApiKey = async () =>
      payload.config?.llm?.apiKey?.trim() ? payload.config.llm.apiKey.trim() : undefined;
    a.state.model = buildModel(
      payload.config?.llm ?? { provider: 'deepseek', model: 'deepseek-chat', apiKey: '' },
    );
    // 手动路由：payload.skill 为字符串则选定，null 则清空，undefined 保持当前不变
    if (payload.skill !== undefined) {
      try {
        applySkill(payload.skill ?? undefined);
      } catch (e) {
        emit({ type: 'error', message: e instanceof Error ? e.message : String(e) });
        currentSender = null;
        return;
      }
    }
    a.state.systemPrompt = resolvedSystemPrompt;
    a.state.tools = tools;

    // 若正在运行，先中止上一轮
    if (a.state.isStreaming) {
      a.abort();
      await a.waitForIdle();
    }

    try {
      await a.prompt(buildPromptText(payload));
    } catch (e) {
      emit({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      currentSender = null;
    }
  });

  ipcMain.handle(AGENT_ABORT_CHANNEL, async () => {
    agent?.abort();
  });

  ipcMain.handle(AGENT_RESET_CHANNEL, async () => {
    agent?.reset();
    assistantCounter = 0;
    currentAssistantId = null;
  });

  ipcMain.handle(AGENT_LIST_SKILLS_CHANNEL, async () => {
    return listSkills();
  });

  ipcMain.handle(AGENT_PICK_FILES_CHANNEL, async (): Promise<AgentAttachment[]> => {
    const win = BrowserWindow.getAllWindows()[0];
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文档', extensions: ['pdf', 'txt', 'md', 'json', 'csv', 'log', 'html'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    const attachments: AgentAttachment[] = [];
    for (const filePath of res.filePaths) {
      const name = path.basename(filePath);
      // 有当前会话时，把上传文件拷贝进会话 uploads 目录，保证会话自包含
      let storedPath = filePath;
      if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
        try {
          storedPath = copyUploadFile(
            sessionRuntime.workspacePath,
            sessionRuntime.sessionId,
            filePath,
          );
        } catch {
          storedPath = filePath;
        }
      }
      try {
        const stat = await fs.promises.stat(storedPath);
        const { type, text } = await readFileText(storedPath);
        attachments.push({
          name,
          path: storedPath,
          type,
          size: stat.size,
          text,
          preview: text?.slice(0, 800),
        });
      } catch (e) {
        attachments.push({
          name,
          path: storedPath,
          type: 'other',
          size: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return attachments;
  });

  ipcMain.handle(SESSION_LIST_FILES_CHANNEL, async (_e, workspacePath: string, id: string) => {
    return listSessionFiles(workspacePath, id);
  });

  ipcMain.handle(SESSION_OPEN_FILE_CHANNEL, async (_e, filePath: string) => {
    const err = await shell.openPath(filePath);
    if (err) throw new Error(err);
    return true;
  });

  ipcMain.handle(WORKSPACE_PICK_CHANNEL, async (): Promise<string | null> => {
    const win = BrowserWindow.getAllWindows()[0];
    const res = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择 workspace 文件夹',
    });
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle(SESSION_LIST_CHANNEL, async (_e, workspacePath: string) => {
    return listSessions(workspacePath);
  });

  ipcMain.handle(SESSION_CREATE_CHANNEL, async (_e, workspacePath: string) => {
    const a = await ensureAgent();
    if (a.state.isStreaming) {
      a.abort();
      await a.waitForIdle();
    }
    currentSender = _e.sender;
    const meta = createSession(workspacePath);
    sessionRuntime.workspacePath = workspacePath;
    sessionRuntime.sessionId = meta.id;
    savedMessageCount = 0;
    a.reset();
    assistantCounter = 0;
    currentAssistantId = null;
    applySkill(undefined);
    emit({ type: 'todo_update', items: [] });
    return meta;
  });

  ipcMain.handle(SESSION_LOAD_CHANNEL, async (_e, workspacePath: string, id: string) => {
    const a = await ensureAgent();
    if (a.state.isStreaming) {
      a.abort();
      await a.waitForIdle();
    }
    currentSender = _e.sender;
    const snap = loadSession(workspacePath, id);
    sessionRuntime.workspacePath = workspacePath;
    sessionRuntime.sessionId = id;
    a.reset();
    a.state.model = buildModel({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '' });
    a.state.tools = tools;
    a.state.messages = snap.messages as AgentMessage[];
    savedMessageCount = snap.messages.length;
    assistantCounter = 0;
    currentAssistantId = null;

    // 恢复当前 skill（applySkill 会设 system prompt 并 emit skill_applied）
    const skill = snap.meta.currentSkill ?? '';
    if (skill) {
      try {
        applySkill(skill);
      } catch {
        applySkill(undefined);
      }
    } else {
      applySkill(undefined);
    }
    // 待办初始投影
    emit({ type: 'todo_update', items: readTodo(workspacePath, id) });
    return snap;
  });

  ipcMain.handle(SESSION_DELETE_CHANNEL, async (_e, workspacePath: string, id: string) => {
    deleteSession(workspacePath, id);
    if (sessionRuntime.workspacePath === workspacePath && sessionRuntime.sessionId === id) {
      (await ensureAgent()).reset();
      sessionRuntime.sessionId = '';
      savedMessageCount = 0;
      assistantCounter = 0;
      currentAssistantId = null;
    }
    return true;
  });

  ipcMain.handle(SESSION_CLEAR_CHANNEL, async (_e, workspacePath: string, id: string) => {
    const a = await ensureAgent();
    if (a.state.isStreaming) {
      a.abort();
      await a.waitForIdle();
    }
    const meta = clearSession(workspacePath, id);
    if (sessionRuntime.workspacePath === workspacePath && sessionRuntime.sessionId === id) {
      a.reset();
      savedMessageCount = 0;
      assistantCounter = 0;
      currentAssistantId = null;
    }
    return meta;
  });
};
