import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Paperclip,
  Square,
  ArrowUp,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  Search,
  TrendingUp,
  LineChart,
  FileText,
  Briefcase,
  Coins,
  Database,
  FileSearch,
  FileDown,
  Wrench,
  ListTodo,
  ClipboardList,
  Download,
  Globe,
  Calculator,
  BarChart3,
  Layers,
  Sparkles,
  Terminal,
  Lightbulb,
  PanelRight,
  type LucideIcon,
} from 'lucide-react';
import type {
  AgentAttachment,
  AgentEvent,
  AgentProvider,
  SavedFileInfo,
} from '@shared/types/agent';
import type { ChatMessage } from '@/models/agent';
import { envAtom } from '@/models/detail';
import { currentSkillAtom, skillIndexAtom } from '@/models/skill';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/lib/markdown';

const SUGGESTIONS = [
  '帮我分析贵州茅台今年的财报，做一个价值投资判断',
  '对宁德时代近一个月的日K线做技术分析',
  '对比一下招商银行和兴业银行的基本面',
];

/** 取路径最后一段（文件名） */
function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

const FILE_DIR_LABELS: Record<SavedFileInfo['dir'], string> = {
  files: '生成文件',
  output: '最终报告',
  intermediate: '中间产物',
  uploads: '上传',
};

/** 单个文件卡片（path 非空时可点击打开） */
function FileCard({ file }: { file: SavedFileInfo }) {
  const inner = (
    <>
      <FileText strokeWidth={1.5} size={18} className="flex-none text-muted-foreground mx-1" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px]">{file.name}</div>
        <div className="text-sm text-muted-foreground">{FILE_DIR_LABELS[file.dir] ?? file.dir}</div>
      </div>
    </>
  );
  if (!file.path) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40  min-w-0 hover:bg-muted/60 cursor-pointer"
        title={file.name}
      >
        {inner}
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40 min-w-0 cursor-pointer hover:bg-accent/60 transition-colors"
      onClick={() => void window.session.openFile(file.path)}
      title={file.path}
    >
      {inner}
    </div>
  );
}

/** 把工具参数摘要成一行「重要参数」，如 read_file 显示文件名 */
function summarizeToolArgs(name: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  switch (name) {
    case 'search_stock':
      return str(a.keyword);
    case 'get_quote':
    case 'get_business':
      return str(a.secid);
    case 'get_klines':
      return `${str(a.secid)} · ${str(a.period) || 'day'} · ${str(a.limit) || '60'} 根`;
    case 'get_financial_statements':
    case 'get_dividends':
      return `${str(a.secid)} · 近 ${str(a.years) || '5'} 年`;
    case 'tushare_query':
      return str(a.api_name);
    case 'read_file':
      return basename(str(a.path));
    case 'save_file':
      return str(a.filename);
    case 'download_url':
      return basename(str(a.url));
    case 'web_search':
      return str(a.query);
    case 'compute_factor':
    case 'analyze_factor':
      return `${str(a.secid)} · ${str(a.factor)}`;
    case 'use_skill':
      return str(a.name);
    case 'run_script':
      return basename(str(a.script));
    case 'decide':
      return str(a.decision);
    case 'list_skills':
      return '';
    case 'list_report_pdfs':
      return str(a.secid);
    case 'download_report_pdf':
      return `${str(a.secid)} · ${str(a.publish_situations)}`;
    default:
      return '';
  }
}

/** 工具名 → 功能图标（展开箭头旁展示） */
const TOOL_ICONS: Record<string, LucideIcon> = {
  update_todo: ListTodo,
  read_todo: ClipboardList,
  decide: Lightbulb,
  list_skills: Layers,
  use_skill: Sparkles,
  run_script: Terminal,
  download_url: Download,
  web_search: Globe,
  compute_factor: Calculator,
  analyze_factor: BarChart3,
  search_stock: Search,
  get_quote: TrendingUp,
  get_klines: LineChart,
  get_financial_statements: FileText,
  get_business: Briefcase,
  get_dividends: Coins,
  tushare_query: Database,
  list_report_pdfs: FileText,
  download_report_pdf: FileDown,
  read_file: FileSearch,
  save_file: FileDown,
};

interface AgentChatProps {
  /** 会话加载/切换后的历史消息（作为初始状态） */
  initialMessages: ChatMessage[];
  /** 是否有活跃会话（无会话时禁用发送） */
  hasSession: boolean;
  /** 一轮运行结束（用于父组件刷新会话列表/标题） */
  onRunEnd?: () => void;
  /** 展开/收起右侧面板 */
  onToggleRightPanel?: () => void;
}

export const AgentChat = memo((props: AgentChatProps) => {
  const { initialMessages, hasSession, onRunEnd, onToggleRightPanel } = props;
  const env = useAtomValue(envAtom);
  const currentSkill = useAtomValue(currentSkillAtom);
  const skillIndex = useAtomValue(skillIndexAtom);
  const setSkillIndex = useSetAtom(skillIndexAtom);
  /** null = 本次会话尚未手动选过；'' = 明确选「无 skill」；字符串 = 选定的 skill 名 */
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [running, setRunning] = useState(false);
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
    const unsubscribe = window.agent.onEvent((e: AgentEvent) => {
      switch (e.type) {
        case 'run_start':
          setRunning(true);
          break;
        case 'run_end':
          setRunning(false);
          onRunEndRef.current?.();
          break;
        case 'assistant_message_start':
          setMessages((prev) => [
            ...prev,
            {
              id: e.messageId,
              role: 'assistant',
              text: '',
              thinking: '',
              tools: [],
              toolsExpanded: false,
              done: false,
            },
          ]);
          break;
        case 'assistant_text_delta':
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === e.messageId);
            const hadText = idx >= 0 && prev[idx].text.length > 0;
            return prev.map((m, i) => {
              if (i === idx) {
                const next = { ...m, text: m.text + e.text };
                // 工具与正文同一条消息：首次正文时收起自身工具
                if (!hadText && m.tools && m.tools.length > 0) {
                  next.toolsExpanded = false;
                  next.tools = m.tools.map((t) => ({ ...t, expanded: false }));
                }
                return next;
              }
              // 工具在之前的消息（工具消息与正文消息是两条）：首次正文时收起前面的工具
              if (!hadText && i < idx && m.tools && m.tools.length > 0) {
                return {
                  ...m,
                  toolsExpanded: false,
                  tools: m.tools.map((t) => ({ ...t, expanded: false })),
                };
              }
              return m;
            });
          });
          break;
        case 'assistant_thinking_delta':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === e.messageId ? { ...m, thinking: (m.thinking ?? '') + e.text } : m,
            ),
          );
          break;
        case 'assistant_message_end':
          setMessages((prev) => prev.map((m) => (m.id === e.messageId ? { ...m, done: true } : m)));
          break;
        case 'tool_start':
          setMessages((prev) => {
            const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant');
            if (!lastAssistant) return prev;
            return prev.map((m) =>
              m.id === lastAssistant.id
                ? {
                    ...m,
                    toolsExpanded: true,
                    tools: [
                      ...(m.tools ?? []),
                      {
                        id: e.toolCallId,
                        name: e.toolName,
                        label: e.label,
                        args: e.args,
                        status: 'running',
                        outputText: '',
                        expanded: true,
                      },
                    ],
                  }
                : m,
            );
          });
          break;
        case 'tool_update':
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              tools: m.tools?.map((t) =>
                t.id === e.toolCallId ? { ...t, outputText: e.outputText ?? t.outputText } : t,
              ),
            })),
          );
          break;
        case 'tool_end':
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              tools: m.tools?.map((t) =>
                t.id === e.toolCallId
                  ? {
                      ...t,
                      status: e.isError ? 'error' : 'done',
                      outputText: e.outputText ?? t.outputText,
                    }
                  : t,
              ),
            })),
          );
          break;
        case 'file_saved':
          setMessages((prev) => {
            const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant');
            if (!lastAssistant) return prev;
            return prev.map((m) =>
              m.id === lastAssistant.id ? { ...m, files: [...(m.files ?? []), e.file] } : m,
            );
          });
          break;
        case 'error':
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'error', text: e.message, done: true },
          ]);
          setRunning(false);
          break;
        default:
          break;
      }
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
  }, [messages]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || running || !hasSession) return;
    setInput('');
    const attached = attachments;
    setAttachments([]);

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text, attachments: attached, done: true },
    ]);
    setRunning(true);
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
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          text: e instanceof Error ? e.message : String(e),
          done: true,
        },
      ]);
      setRunning(false);
    }
  }, [input, running, hasSession, attachments, env, pendingSkill]);

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
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              tools: m.tools?.map((t) => (t.id === toolId ? { ...t, expanded: !t.expanded } : t)),
            }
          : m,
      ),
    );
  }, []);

  const toggleToolsGroup = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, toolsExpanded: !m.toolsExpanded } : m)),
    );
  }, []);

  const showWelcome = messages.length === 0;

  return (
    <div className="w-full h-full flex flex-col text-sm">
      {/* 消息区 */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto px-4 py-4"
        >
          {showWelcome && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="text-lg title text-foreground">你好，我是你的投资分析助手</div>
              <div className="text-sm">
                可以让我分析公司财报、做价值判断，或对个股 K 线做技术分析
              </div>
              {!hasSession ? (
                <div className="text-sm px-3 py-2 rounded-lg border border-border bg-muted">
                  请先在左侧打开 workspace，并新建或选择一个会话
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-border bg-muted hover:bg-accent transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mx-auto max-w-3xl space-y-3">
            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] min-w-0 flex flex-col items-end gap-1.5">
                      {m.attachments?.map((a) => (
                        <div
                          key={a.path}
                          className="text-xs px-2 py-1 rounded bg-muted border border-border flex items-center gap-1 max-w-full"
                        >
                          <Paperclip size={12} />
                          <span className="truncate">{a.name}</span>
                          {a.error && <span className="text-destructive">读取失败</span>}
                        </div>
                      ))}
                      <div className="px-3 py-2 rounded-xl rounded-tr-none bg-primary text-primary-foreground text-base whitespace-pre-wrap break-words">
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.role === 'error') {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-sm max-w-[85%] break-words">
                      {m.text}
                    </div>
                  </div>
                );
              }

              // assistant
              return (
                <div key={m.id} className="flex justify-start space-y-3">
                  <div className="max-w-[92%] w-full min-w-0 space-y-3">
                    {/* 思考过程 */}
                    {m.thinking && (
                      <details className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
                        <summary className="cursor-pointer">思考过程</summary>
                        <div className="mt-1 whitespace-pre-wrap break-words">{m.thinking}</div>
                      </details>
                    )}

                    {/* 正文 */}
                    {m.text ? (
                      <div>
                        <Markdown text={m.text} />
                        {!m.done && (
                          <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                        )}
                      </div>
                    ) : (
                      m.done === false && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" />
                          正在分析…
                        </div>
                      )
                    )}

                    {/* 本轮工具调用（极简 codex 风格） */}
                    {m.tools && m.tools.length > 0 && (
                      <div>
                        {/* 组标题：与正文对齐，无竖线 */}
                        <div
                          role="button"
                          onClick={() => toggleToolsGroup(m.id)}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
                        >
                          {m.toolsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <Wrench size={14} />
                          <span>工具调用</span>
                          <span>({m.tools.length})</span>
                          {m.tools.some((t) => t.status === 'running') && (
                            <Loader2 size={13} className="animate-spin" />
                          )}
                          {m.tools.some((t) => t.status === 'error') && (
                            <span className="text-destructive">· 有失败</span>
                          )}
                        </div>

                        {/* 工具列表：左侧竖线标识子级 */}
                        {m.toolsExpanded && (
                          <div className="ml-2 pl-3 border-l border-border/70 space-y-2 mt-2">
                            {m.tools.map((t) => {
                              const ToolIcon = TOOL_ICONS[t.name] ?? Wrench;
                              return (
                                <div key={t.id}>
                                  <div
                                    role="button"
                                    onClick={() => toggleTool(m.id, t.id)}
                                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
                                  >
                                    {t.expanded ? (
                                      <ChevronDown size={12} />
                                    ) : (
                                      <ChevronRight size={12} />
                                    )}
                                    <ToolIcon size={13} className="flex-none" />
                                    <span className="flex-none" title={t.name}>
                                      {t.label}
                                    </span>
                                    <span className="truncate">
                                      {summarizeToolArgs(t.name, t.args)}
                                    </span>
                                    {t.status === 'running' && (
                                      <Loader2 size={12} className="animate-spin flex-none" />
                                    )}
                                    {t.status === 'error' && (
                                      <span className="text-destructive flex-none">失败</span>
                                    )}
                                  </div>
                                  {t.expanded && (
                                    <pre className="pl-8 mt-1.5 text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto font-mono text-muted-foreground">
                                      {t.outputText || '（无输出）'}
                                    </pre>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 本轮保存/下载的文件卡片（每行两个） */}
                    {m.files && m.files.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {m.files.map((f, i) => (
                          <FileCard key={`${f.name}-${i}`} file={f} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border text-xs hover:bg-muted"
            title="跳到底部"
          >
            <ArrowDown size={14} />
            跳到底部
          </button>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex-none py-3 pr-4">
        <div className="mx-auto max-w-3xl">
          {/* 待发送附件 */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((a) => (
                <div
                  key={a.path}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted border border-border"
                >
                  <Paperclip size={12} />
                  <span className="max-w-40 truncate">{a.name}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.path !== a.path))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 圆角输入框 */}
          <div className="rounded-2xl border border-input bg-background">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={3}
              placeholder={
                hasSession
                  ? '输入你的问题，如：分析某公司财报 / 对某股票做技术分析…（Enter 发送，Shift+Enter 换行）'
                  : '请先在左侧打开 workspace 并选择会话'
              }
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
              spellCheck={false}
              disabled={!hasSession}
            />

            {/* action 行 */}
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onAttach}
                  disabled={running || !hasSession}
                  title="附加文件（PDF/文本）"
                  className="rounded-full"
                >
                  <Paperclip size={16} />
                </Button>
                <Select
                  value={
                    pendingSkill !== null ? pendingSkill || 'none' : (currentSkill?.name ?? 'none')
                  }
                  onValueChange={(v) => setPendingSkill(v === 'none' ? '' : v)}
                  disabled={!hasSession || running}
                >
                  <SelectTrigger size="default" className="h-8 gap-1 text-xs rounded-full">
                    <SelectValue placeholder="选择 skill" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[340px] max-w-[440px]">
                    <SelectItem value="none">无 skill（自由对话）</SelectItem>
                    {skillIndex.map((s) => (
                      <SelectItem key={s.name} value={s.name} hint={s.description}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onToggleRightPanel}
                  className="rounded-full"
                  title="展开右侧面板"
                >
                  <PanelRight size={16} />
                </Button>
                {running ? (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={onAbort}
                    title="停止"
                    className="rounded-full hover:opacity-75"
                  >
                    <Square size={16} />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={onSend}
                    disabled={!input.trim() || !hasSession}
                    title="发送"
                    className="rounded-full"
                  >
                    <ArrowUp size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AgentChat.displayName = 'AgentChat';
