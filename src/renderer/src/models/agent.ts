import { atom } from 'jotai';
import type { AgentAttachment, AgentEvent, SavedFileInfo } from '@shared/types/agent';
import type { KeyMoveEntry, KeyMoveList } from '@shared/types/key-move';

/** 实时视图里的工具调用卡片状态 */
export interface ToolCallState {
  id: string;
  name: string;
  label: string;
  args?: unknown;
  status: 'running' | 'done' | 'error';
  outputText?: string;
  /** 是否展开显示工具返回值 */
  expanded: boolean;
}

/** 渲染层使用的聊天消息模型 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  thinking?: string;
  attachments?: AgentAttachment[];
  /** 本轮 turn 的所有工具调用（实时与历史视图通用） */
  tools?: ToolCallState[];
  /** 本轮工具调用组是否展开（折叠时只显示「工具调用」标题） */
  toolsExpanded?: boolean;
  /** 本轮 turn 保存/下载的文件（渲染成对话底部文件卡片） */
  files?: SavedFileInfo[];
  /** 本轮 turn 计算出的关键行情区间（渲染成气泡内可点击列表） */
  keyMoves?: KeyMoveList[];
  done?: boolean;
}

let seq = 0;
function genId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}-${Date.now()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contentToText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === 'text' && typeof b?.text === 'string')
      .map((b: any) => b.text)
      .join('');
  }
  return '';
}

/** 工具名 → 中文名（历史视图还原用，与主进程 toolLabels 一致） */
export const TOOL_LABELS: Record<string, string> = {
  update_todo: '更新任务清单',
  read_todo: '读取任务清单',
  decide: '记录决策',
  list_skills: '列出技能',
  use_skill: '选定技能',
  run_script: '执行脚本',
  download_url: '下载文件',
  compute_factor: '计算因子信号',
  analyze_factor: '因子回测统计',
  search_stock: '搜索股票',
  get_quote: '行情快照',
  get_klines: 'K线数据',
  get_key_moves: '关键行情区间',
  get_financial_statements: '财务报表',
  get_business: '主营构成',
  get_dividends: '分红历史',
  tushare_query: 'Tushare 数据',
  list_report_pdfs: '财报PDF列表',
  download_report_pdf: '下载财报PDF',
  read_file: '读取文件',
  save_file: '保存文件',
};

/** 取路径最后一段（文件名） */
function basenameOf(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p;
}

/** 按会话目录结构还原文件的绝对路径（供点击打开），无 workspace/会话时返回空 */
function sessionFilePath(
  workspacePath: string,
  sessionId: string,
  dir: SavedFileInfo['dir'],
  name: string,
): string {
  if (!workspacePath || !sessionId) return '';
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  const base = basenameOf(name);
  const root = workspacePath.replace(/[\\/]+$/, '');
  return `${root}${sep}.ss-invst${sep}sessions${sep}${sessionId}${sep}${dir}${sep}${base}`;
}

/** 从 toolCall 参数里还原保存/下载的文件（历史视图用） */
function fileFromToolCall(
  name: string,
  args: unknown,
  workspacePath: string,
  sessionId: string,
): SavedFileInfo | null {
  const a = (args ?? {}) as Record<string, unknown>;
  if (name === 'save_file') {
    const filename = typeof a.filename === 'string' ? a.filename.trim() : '';
    if (!filename) return null;
    const dir =
      a.dir === 'output' || a.dir === 'intermediate' || a.dir === 'uploads' ? a.dir : 'files';
    return { name: filename, path: sessionFilePath(workspacePath, sessionId, dir, filename), dir };
  }
  if (name === 'download_url') {
    const url = typeof a.url === 'string' ? a.url : '';
    const name = url.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '下载文件';
    return {
      name,
      path: sessionFilePath(workspacePath, sessionId, 'uploads', name),
      dir: 'uploads',
    };
  }
  return null;
}

/**
 * 把持久化的 pi-agent AgentMessage[] 映射成渲染层 ChatMessage[]。
 * 每个 assistant 的 toolCall 块还原成 ToolCallState，并把后续的 toolResult
 * 回填到对应工具上，从而历史视图也能像实时视图一样展开查看工具返回值。
 */
export function mapAgentMessages(
  msgs: unknown[],
  workspacePath = '',
  sessionId = '',
  keyMoves: KeyMoveEntry[] = [],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  // 上一条 assistant 消息的工具列表，用于回填 toolResult
  let pendingTools: ToolCallState[] | null = null;

  for (const raw of msgs) {
    const m = raw as {
      role?: string;
      content?: unknown;
      stopReason?: string;
      errorMessage?: string;
      toolCallId?: string;
      isError?: boolean;
    };
    if (!m || typeof m !== 'object') continue;

    if (m.role === 'user') {
      out.push({ id: genId('hu'), role: 'user', text: contentToText(m.content), done: true });
      pendingTools = null;
      continue;
    }

    if (m.role === 'toolResult') {
      if (pendingTools) {
        const t = pendingTools.find((x) => x.id === m.toolCallId);
        if (t) {
          t.outputText = contentToText(m.content) || '（无输出）';
          if (m.isError) t.status = 'error';
        }
      }
      continue;
    }

    if (m.role === 'assistant') {
      // 出错的 assistant 消息（如缺 API key）映射成错误气泡，而不是空的 assistant 气泡
      if (m.stopReason === 'error') {
        out.push({
          id: genId('he'),
          role: 'error',
          text: m.errorMessage || '请求失败',
          done: true,
        });
        pendingTools = null;
        continue;
      }

      let text = '';
      let thinking = '';
      const tools: ToolCallState[] = [];
      const files: SavedFileInfo[] = [];
      const messageKeyMoves: KeyMoveList[] = [];
      for (const b of (m.content as any[]) ?? []) {
        if (b?.type === 'text' && typeof b?.text === 'string') text += b.text;
        else if (b?.type === 'thinking' && typeof b?.thinking === 'string') thinking += b.thinking;
        else if (b?.type === 'toolCall' && typeof b?.name === 'string') {
          const toolCallId = typeof b.id === 'string' ? b.id : genId('t');
          tools.push({
            id: toolCallId,
            name: b.name,
            label: TOOL_LABELS[b.name] ?? b.name,
            args: b.arguments,
            status: 'done',
            outputText: '',
            expanded: false,
          });
          const f = fileFromToolCall(b.name, b.arguments, workspacePath, sessionId);
          if (f) files.push(f);
          const km = keyMoves.find((e) => e.toolCallId === toolCallId);
          if (km) messageKeyMoves.push({ security: km.security, items: km.items });
        }
      }

      out.push({
        id: genId('ha'),
        role: 'assistant',
        text,
        thinking: thinking || undefined,
        tools: tools.length ? tools : undefined,
        toolsExpanded: false,
        files: files.length ? files : undefined,
        keyMoves: messageKeyMoves.length ? messageKeyMoves : undefined,
        done: true,
      });
      pendingTools = tools.length ? tools : null;
    }
  }
  return out;
}

/** 调试面板里的一条事件记录 */
export interface DebugEventEntry {
  id: number;
  time: string;
  event: AgentEvent;
}

export const MAX_DEBUG_EVENTS = 500;

export const debugEventsAtom = atom<DebugEventEntry[]>([]);

let debugSeq = 0;

/** 往调试面板追加一条事件（带时间戳，超限丢弃最旧） */
export function appendDebugEvent(
  set: (fn: (prev: DebugEventEntry[]) => DebugEventEntry[]) => void,
  event: AgentEvent,
): void {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  debugSeq += 1;
  set((prev) => {
    const next = [...prev, { id: debugSeq, time, event }];
    return next.length > MAX_DEBUG_EVENTS ? next.slice(next.length - MAX_DEBUG_EVENTS) : next;
  });
}
