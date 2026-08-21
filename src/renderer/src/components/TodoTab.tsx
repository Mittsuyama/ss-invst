import { memo } from 'react';
import { useAtomValue } from 'jotai';
import { ListChecks, Lightbulb } from 'lucide-react';
import { todoAtom, decisionAtom } from '@/models/todo';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';

export const TodoTab = memo(() => {
  const todos = useAtomValue(todoAtom);
  const decisions = useAtomValue(decisionAtom);

  return (
    <div className="h-full overflow-y-auto px-2 py-2 space-y-4">
      {/* 待办 */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1">
          <ListChecks size={12} />
          待办（{todos.length}）
        </div>
        {todos.length === 0 ? (
          <div className="text-[11px] text-muted-foreground px-2 py-1">暂无任务</div>
        ) : (
          <ul className="space-y-0.5">
            {todos.map((t, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  t.status === 'in_progress' ? 'bg-accent text-foreground' : 'text-foreground'
                }`}
              >
                {t.status === 'in_progress' ? (
                  <Spinner className="size-3.5 flex-none" />
                ) : (
                  <Checkbox
                    checked={t.status === 'done'}
                    className="size-3.5 flex-none pointer-events-none"
                    aria-label={t.title}
                  />
                )}
                <span className={t.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                  {t.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 决策日志 */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1">
          <Lightbulb size={12} />
          决策日志（{decisions.length}）
        </div>
        {decisions.length === 0 ? (
          <div className="text-[11px] text-muted-foreground px-2 py-1">暂无决策</div>
        ) : (
          <ul className="space-y-2">
            {decisions.map((d, i) => (
              <li key={i} className="px-2 py-1 rounded text-xs space-y-1">
                <div className="text-[11px] text-muted-foreground">{d.time}</div>
                <div className="break-words">{d.decision}</div>
                {d.reason && (
                  <div className="text-[11px] text-muted-foreground break-words">
                    理由：{d.reason}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

TodoTab.displayName = 'TodoTab';
