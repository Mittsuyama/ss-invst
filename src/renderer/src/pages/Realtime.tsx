import { memo, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAtom } from 'jotai';
import { RotateCcw, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Plus } from 'lucide-react';
import { realtimeDirectionAtom, realtimeStockIdListAtom } from '@/models/detail';
import { Direction } from '@shared/types/meta';
import { FilterItem } from '@renderer/types/search';
import { ButtonGroup } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';
import { RealtimeCard } from '@/components/RealtimeCard';
import { SearchPannel } from '@/components/SearchPannel';
import { useMemoizedFn } from 'ahooks';
import { fetchFilterList } from '@renderer/api/stock';
import { Portal } from 'vaul';

export const Realtime = memo(() => {
  const [ids, setIds] = useAtom(realtimeStockIdListAtom);
  const [list, setList] = useState<FilterItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [direction, setDirection] = useAtom(realtimeDirectionAtom);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(0);

  const onSelect = useMemoizedFn((id: string) => {
    setIds((pre) => [id, ...pre.filter((item) => item !== id)]);
  });

  const sort = useMemoizedFn((a: FilterItem, b: FilterItem, d: Direction | null) => {
    if (!d) {
      return b.totalMarketValue - a.totalMarketValue;
    }
    const key: keyof FilterItem = 'kdj_fifteen_minute';
    if (d === 'asc') {
      return a[key] - b[key];
    }
    return b[key] - a[key];
  });

  const fetch = useMemoizedFn(async (ids: string[], d = direction) => {
    if (!ids.length) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetchFilterList(
        `${ids.map((item) => item.split('.')[1]).join(';')};周线周期KDJ(J值);日线周期KDJ(J值);30分钟线周期KDJ(J值);15分钟线周期KDJ(J值)`,
      );
      setList(res.list.sort((a, b) => sort(a, b, d)));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    fetch(ids, direction);
  }, [ids, fetch, direction]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      fetch(ids);
      setCount((pre) => pre + 1);
    }, 30_000);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [fetch, ids]);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      <SearchPannel open={searchOpen} onOpenChange={setSearchOpen} onSecuritySelect={onSelect} />
      <div className="flex items-center px-6 my-2 flex-none">
        <div className="font-bold">实时</div>
        <ButtonGroup className="ml-auto">
          <Button onClick={() => setCount((pre) => pre + 1)} variant="outline">
            <RotateCcw className={clsx({ 'animate-spin': loading })} />
            刷新
          </Button>
          <Button
            onClick={() => {
              const d = !direction ? 'desc' : direction === 'desc' ? 'asc' : null;
              setDirection(d);
            }}
            variant="outline"
          >
            {!direction ? (
              <ArrowUpDown />
            ) : direction === 'asc' ? (
              <ArrowUpNarrowWide />
            ) : (
              <ArrowDownWideNarrow />
            )}
            {!direction ? '未排序' : direction === 'asc' ? '升序' : '降序'}
          </Button>
          <Button variant="outline" onClick={() => setSearchOpen(true)}>
            <Plus />
            新增
          </Button>
        </ButtonGroup>
      </div>
      <div className=" flex-1 overflow-auto">
        <div className="grid grid-cols-3 lg:grid-cols-4 px-6 my-2 gap-3">
          {list?.map((item) => (
            <RealtimeCard
              value={item.kdj_fifteen_minute}
              name={item.name}
              key={`${item.id}-${count}`}
              id={item.id}
              onRemove={() => setIds((pre) => pre.filter((id) => id !== item.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

Realtime.displayName = 'Realtime';
