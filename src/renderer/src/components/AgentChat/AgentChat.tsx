import { memo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ChatMessage } from '@/models/agent';
import { useAgentChat } from './useAgentChat';
import { Welcome } from './Welcome';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { MarkdownPreviewDrawer } from './MarkdownPreviewDrawer';

export interface AgentChatProps {
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
  const chat = useAgentChat({ initialMessages, hasSession, onRunEnd });
  const showWelcome = chat.messages.length === 0;

  return (
    <div className="w-full h-full text-sm relative">
      {/* 消息区 */}
      <div className="w-full h-full relative min-h-0">
        <div
          ref={chat.scrollRef}
          onScroll={chat.onScroll}
          className="absolute inset-0 overflow-y-auto px-4 py-4 pb-38"
        >
          {showWelcome && (
            <Welcome hasSession={hasSession} onPickSuggestion={(s) => chat.setInput(s)} />
          )}
          <MessageList
            messages={chat.messages}
            onToggleTool={chat.toggleTool}
            onToggleToolsGroup={chat.toggleToolsGroup}
            onPreview={chat.setPreviewFile}
          />
        </div>
        {chat.showScrollButton && (
          <button
            onClick={chat.scrollToBottom}
            className="absolute bottom-38 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border text-xs hover:bg-muted"
            title="跳到底部"
          >
            <ArrowDown size={14} />
            跳到底部
          </button>
        )}
      </div>

      {/* 输入区 */}
      <ChatInput
        input={chat.input}
        onInputChange={chat.setInput}
        attachments={chat.attachments}
        onRemoveAttachment={chat.removeAttachment}
        running={chat.running}
        hasSession={hasSession}
        onSend={chat.onSend}
        onAbort={chat.onAbort}
        onAttach={chat.onAttach}
        onToggleRightPanel={onToggleRightPanel}
        pendingSkill={chat.pendingSkill}
        onPendingSkillChange={chat.setPendingSkill}
        currentSkill={chat.currentSkill}
        skillIndex={chat.skillIndex}
      />

      {/* Markdown 预览抽屉 */}
      <MarkdownPreviewDrawer
        open={chat.previewFile !== null}
        onClose={() => chat.setPreviewFile(null)}
        file={chat.previewFile}
      />
    </div>
  );
});

AgentChat.displayName = 'AgentChat';
