import { Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/models/agent';
import type { SavedFileInfo } from '@shared/types/agent';
import { Markdown } from '@/lib/markdown';
import { KeyMovesCard } from './KeyMovesCard';
import { FileCard } from './FileCard';
import { ToolCalls } from './ToolCalls';

interface AssistantMessageProps {
  message: ChatMessage;
  onToggleTool: (messageId: string, toolId: string) => void;
  onToggleToolsGroup: (messageId: string) => void;
  onPreview: (file: SavedFileInfo) => void;
}

/** assistant 消息：思考过程 + 正文 + 工具调用 + 关键行情 + 文件卡片 */
export function AssistantMessage({
  message,
  onToggleTool,
  onToggleToolsGroup,
  onPreview,
}: AssistantMessageProps) {
  return (
    <div className="flex justify-start space-y-3">
      <div className="max-w-[92%] w-full min-w-0 space-y-3">
        {/* 思考过程 */}
        {message.thinking && (
          <details className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
            <summary className="cursor-pointer">思考过程</summary>
            <div className="mt-1 whitespace-pre-wrap break-words">{message.thinking}</div>
          </details>
        )}

        {/* 正文 */}
        {message.text ? (
          <div>
            <Markdown text={message.text} />
            {!message.done && (
              <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          message.done === false && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              正在分析…
            </div>
          )
        )}

        <ToolCalls
          message={message}
          onToggleTool={onToggleTool}
          onToggleToolsGroup={onToggleToolsGroup}
        />

        {/* 本轮计算出的关键行情区间卡片 */}
        {message.keyMoves && message.keyMoves.length > 0 && (
          <div className="space-y-2">
            {message.keyMoves.map((km, i) => (
              <KeyMovesCard key={`${km.security.id}-${i}`} list={km} />
            ))}
          </div>
        )}

        {/* 本轮保存/下载的文件卡片（每行两个） */}
        {message.files && message.files.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {message.files.map((f, i) => (
              <FileCard key={`${f.name}-${i}`} file={f} onPreview={onPreview} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
