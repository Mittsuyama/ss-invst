import { ArrowUp, PanelRight, Paperclip, Square } from 'lucide-react';
import type { AgentAttachment, SkillInfo } from '@shared/types/agent';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  attachments: AgentAttachment[];
  onRemoveAttachment: (path: string) => void;
  running: boolean;
  hasSession: boolean;
  onSend: () => void;
  onAbort: () => void;
  onAttach: () => void;
  onToggleRightPanel?: () => void;
  pendingSkill: string | null;
  onPendingSkillChange: (value: string | null) => void;
  currentSkill: { name: string; description?: string } | null;
  skillIndex: SkillInfo[];
}

/** 底部输入区：附件、文本框、skill 选择与发送/停止 */
export function ChatInput(props: ChatInputProps) {
  const {
    input,
    onInputChange,
    attachments,
    onRemoveAttachment,
    running,
    hasSession,
    onSend,
    onAbort,
    onAttach,
    onToggleRightPanel,
    pendingSkill,
    onPendingSkillChange,
    currentSkill,
    skillIndex,
  } = props;

  return (
    <div className="absolute left-0 bottom-0 w-full">
      <div className="flex-none mx-auto w-[52rem] pb-4 bg-background">
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
                  onClick={() => onRemoveAttachment(a.path)}
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
            onChange={(e) => onInputChange(e.target.value)}
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
                onValueChange={(v) => onPendingSkillChange(v === 'none' ? '' : v)}
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
  );
}
