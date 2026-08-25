import { Paperclip } from 'lucide-react';
import type { ChatMessage } from '@/models/agent';
import type { SavedFileInfo } from '@shared/types/agent';
import { AssistantMessage } from './AssistantMessage';

interface MessageListProps {
  messages: ChatMessage[];
  onToggleTool: (messageId: string, toolId: string) => void;
  onToggleToolsGroup: (messageId: string) => void;
  onPreview: (file: SavedFileInfo) => void;
}

/** 消息列表：分发 user / error / assistant 三种气泡 */
export function MessageList({
  messages,
  onToggleTool,
  onToggleToolsGroup,
  onPreview,
}: MessageListProps) {
  return (
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

        return (
          <AssistantMessage
            key={m.id}
            message={m}
            onToggleTool={onToggleTool}
            onToggleToolsGroup={onToggleToolsGroup}
            onPreview={onPreview}
          />
        );
      })}
    </div>
  );
}
