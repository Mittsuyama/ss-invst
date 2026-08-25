import { SUGGESTIONS } from './constants';

interface WelcomeProps {
  hasSession: boolean;
  onPickSuggestion: (suggestion: string) => void;
}

/** 空会话时的欢迎页与建议问题 */
export function Welcome({ hasSession, onPickSuggestion }: WelcomeProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="text-lg title text-foreground">你好，我是你的投资分析助手</div>
      <div className="text-sm">可以让我分析公司财报、做价值判断，或对个股 K 线做技术分析</div>
      {!hasSession ? (
        <div className="text-sm px-3 py-2 rounded-lg border border-border bg-muted">
          请先在左侧打开 workspace，并新建或选择一个会话
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPickSuggestion(s)}
              className="text-left text-sm px-3 py-2 rounded-lg border border-border bg-muted hover:bg-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
