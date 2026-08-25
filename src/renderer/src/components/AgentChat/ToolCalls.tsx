import { ChevronDown, ChevronRight, Loader2, Wrench } from 'lucide-react';
import type { ChatMessage } from '@/models/agent';
import { TOOL_ICONS } from './constants';
import { summarizeToolArgs } from './toolSummary';

interface ToolCallsProps {
  message: ChatMessage;
  onToggleTool: (messageId: string, toolId: string) => void;
  onToggleToolsGroup: (messageId: string) => void;
}

/** 本轮工具调用（极简 codex 风格） */
export function ToolCalls({ message, onToggleTool, onToggleToolsGroup }: ToolCallsProps) {
  const { tools, toolsExpanded, id } = message;
  if (!tools || tools.length === 0) return null;

  return (
    <div>
      {/* 组标题：与正文对齐，无竖线 */}
      <div
        role="button"
        onClick={() => onToggleToolsGroup(id)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
      >
        {toolsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Wrench size={14} />
        <span>工具调用</span>
        <span>({tools.length})</span>
        {tools.some((t) => t.status === 'running') && (
          <Loader2 size={13} className="animate-spin" />
        )}
        {tools.some((t) => t.status === 'error') && (
          <span className="text-destructive">· 有失败</span>
        )}
      </div>

      {/* 工具列表：左侧竖线标识子级 */}
      {toolsExpanded && (
        <div className="ml-2 pl-3 border-l border-border/70 space-y-2 mt-2">
          {tools.map((t) => {
            const ToolIcon = TOOL_ICONS[t.name] ?? Wrench;
            return (
              <div key={t.id}>
                <div
                  role="button"
                  onClick={() => onToggleTool(id, t.id)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
                >
                  {t.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <ToolIcon size={13} className="flex-none" />
                  <span className="flex-none" title={t.name}>
                    {t.label}
                  </span>
                  <span className="truncate">{summarizeToolArgs(t.name, t.args)}</span>
                  {t.status === 'running' && (
                    <Loader2 size={12} className="animate-spin flex-none" />
                  )}
                  {t.status === 'error' && <span className="text-destructive flex-none">失败</span>}
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
  );
}
