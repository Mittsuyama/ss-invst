import { memo, useState } from 'react';
import { Activity } from 'lucide-react';
import type { KeyMove, KeyMoveList } from '@shared/types/key-move';
import { GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { KeyMoveDrawer } from './KeyMoveDrawer';

/** 一只证券的关键行情区间列表（气泡内卡片），每项可点击打开抽屉 */
const KeyMovesCardInner = ({ list }: { list: KeyMoveList }) => {
  const { security, items } = list;
  const [selected, setSelected] = useState<KeyMove | null>(null);

  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
      <div className="flex items-center gap-2 text-sm px-0.5 mb-1.5">
        <Activity size={14} className="text-muted-foreground flex-none" />
        <span className="font-medium">{security.name}</span>
        <span className="text-muted-foreground text-xs">{security.code}</span>
        <span className="text-muted-foreground text-xs ml-auto">关键行情区间 · {items.length}</span>
      </div>
      <div className="space-y-0.5">
        {items.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelected(m)}
            className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded text-left hover:bg-accent/60 transition-colors"
          >
            <span className="text-xs text-muted-foreground tabular-nums">
              {m.start} ~ {m.end}
            </span>
            <span
              className="text-sm font-medium tabular-nums"
              style={{ color: m.changeRate >= 0 ? RED_COLOR : GREEN_COLOR }}
            >
              {m.changeRate >= 0 ? '+' : ''}
              {m.changeRate.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
      <KeyMoveDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        security={security}
        move={selected}
      />
    </div>
  );
};

export const KeyMovesCard = memo(KeyMovesCardInner);
