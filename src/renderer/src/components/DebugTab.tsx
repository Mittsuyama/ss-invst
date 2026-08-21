import { memo, useState } from 'react';
import { useAtom } from 'jotai';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { debugEventsAtom, type DebugEventEntry } from '@/models/agent';

function summary(event: DebugEventEntry['event']): string {
  switch (event.type) {
    case 'run_start':
      return 'run_start';
    case 'run_end':
      return 'run_end';
    case 'assistant_message_start':
      return `assistant_message_start ${event.messageId}`;
    case 'assistant_text_delta':
      return `text_delta +${event.text.length} 字符`;
    case 'assistant_thinking_delta':
      return `thinking_delta +${event.text.length} 字符`;
    case 'assistant_message_end':
      return `assistant_message_end ${event.messageId}`;
    case 'tool_start':
      return `tool_start ${event.toolName}`;
    case 'tool_update':
      return `tool_update ${event.toolCallId}`;
    case 'tool_end':
      return `tool_end ${event.toolName}${event.isError ? ' (失败)' : ''}`;
    case 'error':
      return `error: ${event.message}`;
    default:
      return (event as { type: string }).type;
  }
}

export const DebugTab = memo(() => {
  const [events, setEvents] = useAtom(debugEventsAtom);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none flex items-center justify-between px-2 py-1.5">
        <span className="text-xs text-muted-foreground">事件流（{events.length}）</span>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground flex items-center gap-1 text-[11px]"
          onClick={() => {
            setEvents([]);
            setExpanded({});
          }}
          title="清空"
        >
          <Trash2 size={12} />
          清空
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 font-mono">
        {events.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            暂无事件，发一条消息后这里会实时显示
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="border border-border/60 rounded-md overflow-hidden">
            <button
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] hover:bg-accent/60"
              onClick={() => setExpanded((prev) => ({ ...prev, [e.id]: !prev[e.id] }))}
            >
              {expanded[e.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-muted-foreground flex-none">{e.time}</span>
              <span className="text-blue-600 dark:text-blue-400 truncate">{summary(e.event)}</span>
            </button>
            {expanded[e.id] && (
              <pre className="px-2 py-1.5 border-t border-border/60 text-[10px] whitespace-pre-wrap break-all text-muted-foreground max-h-72 overflow-y-auto">
                {JSON.stringify(e.event, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

DebugTab.displayName = 'DebugTab';
