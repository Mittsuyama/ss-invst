import { memo, useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useHistory, useParams } from 'react-router-dom';
import { RotateCcw, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { AreaChart } from '@visactor/react-vchart';
import { RequestType } from '@shared/types/request';
import { useLatestRequest } from '@/hooks/use-latest-request';
import { request } from '@/lib/request';
import { GREEN_RGB, RED_RGB, GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { FilterItem, HistoryOption } from '@renderer/types/search';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { RouterKey } from '@renderer/types/global';
import {
  favStockIdListAtom,
  quickNavDirectionAtom,
  watchStockIdListAtom,
} from '@renderer/models/detail';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Direction } from '@shared/types/meta';
import { searchOpenAtom } from '@renderer/models/search';
import { fetchFilterList } from '@renderer/api/stock';

interface NavItemProps {
  detail: HistoryOption;
  lines: PriceAndVolumeItem[];
}

const SAMPLE_GAP = 5;

const NavItem = memo((props: NavItemProps) => {
  const { detail, lines } = props;
  const { id, title } = detail;
  const { id: idFromParams } = useParams<{ id: string }>();
  const history = useHistory();
  const last = lines.at(-1);

  const diff = useMemo(() => {
    if (!lines) {
      return {
        open: 0,
        close: 0,
        max: 0,
        rate: 0,
      };
    }
    const open = lines[0].open;
    const close = lines[lines.length - 1].close;
    const rate = (close - open) / open;
    const max = Math.max(...lines.map((item) => Math.abs(item.close - open)));
    return { open, close, rate, max };
  }, [lines]);

  return (
    <div
      className={clsx('flex px-3 py-2 my-0.5 gap-3 rounded-md items-center cursor-default', {
        'bg-accent': id === idFromParams,
        'hover:bg-accent': id !== idFromParams,
      })}
      onClick={() => history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', id))}
    >
      <div className="flex-none">
        <div className="text-sm mb-1">{title}</div>
        <div className="text-xs text-muted-foreground">{id}</div>
      </div>
      <div className="flex-1 h-12 overflow-hidden pointer-events-none">
        <AreaChart
          spec={{
            type: 'area',
            data: {
              values: (lines || []).filter(
                (item) =>
                  dayjs(item.timestamp).minute() % SAMPLE_GAP ===
                    dayjs(last?.timestamp || 0).minute() % SAMPLE_GAP &&
                  // 只显示 9:30 后的数据
                  (dayjs(item.timestamp).hour() > 9 || dayjs(item.timestamp).minute() >= 30),
              ),
            },
            background: 'transparent',
            stack: true,
            xField: 'timestamp',
            yField: 'close',
            point: { visible: false },
            padding: [0],
            tooltip: {
              visible: false,
            },
            axes: [
              {
                orient: 'left',
                visible: false,
                min: diff.open - diff.max - diff.open * 0.005,
                max: diff.open + diff.max + diff.open * 0.005,
              },
              {
                orient: 'bottom',
                visible: false,
              },
            ],
            line: {
              style: {
                lineWidth: 1,
                stroke: `rgba(${diff.rate > 0 ? RED_RGB : GREEN_RGB}, 1)`,
                curveType: 'monotone',
              },
            },
            area: {
              style: {
                fill: {
                  gradient: 'linear',
                  stops: [
                    {
                      offset: 0,
                      color: `rgba(${diff.rate > 0 ? RED_RGB : GREEN_RGB}, 0.3)`,
                    },
                    {
                      offset: 0.9,
                      color: 'rgba(255, 255, 255, 0)',
                    },
                  ],
                },
                // fill: `rgba(${diff.rate > 0 ? RED_RGB : GREEN_RGB}, 0.1)`,
              },
            },
            markLine: [
              {
                y: diff.open,
                line: {
                  style: {
                    stroke: '#ddd',
                  },
                },
                endSymbol: {
                  visible: false,
                },
              },
            ],
            animationUpdate: false,
            animationAppear: false,
            animationEnter: false,
            animationExit: false,
          }}
        />
      </div>
      <div
        style={{
          background: `rgba(${!diff.rate ? '100, 100, 100' : diff.rate > 0 ? RED_RGB : GREEN_RGB}, 1)`,
        }}
        className="w-14 h-6 text-white text-xs flex justify-center items-center rounded-sm"
      >
        {(diff.rate * 100).toFixed(2)}%
      </div>
    </div>
  );
});

NavItem.displayName = 'NavItem';

interface SimpleItemProps {
  detail: FilterItem;
}

const SimpleItem = memo((props: SimpleItemProps) => {
  const { detail } = props;
  const { id, code, name, price, chg } = detail;

  const history = useHistory();
  const { id: idFromParams } = useParams<{ id: string }>();

  const kdjRender = (value?: number, label?: string) => {
    if (typeof value !== 'number') {
      return <div className="text-foreground">-</div>;
    }
    const max = 85;
    const min = 10;
    return (
      <div
        className="flex-1 text-muted-foreground flex items-center"
        style={value >= max ? { color: RED_COLOR } : value < min ? { color: GREEN_COLOR } : {}}
      >
        {value.toFixed(1)}
        <div
          className="ml-2 flex items-center"
          style={{ visibility: value >= min && value < max ? 'hidden' : 'visible' }}
        >
          <div className="pb-0.5">{value >= max ? '▲' : value < min ? '▼' : '▼'}</div>
          <div className="ml-1">{label}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-nav-stock-id={detail.id}
      className={clsx('flex px-3 py-2 my-0.5 rounded-md items-center cursor-default', {
        'bg-accent': id === idFromParams,
        'hover:bg-accent': id !== idFromParams,
      })}
      onClick={() => history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', id))}
    >
      <div className="flex-none">
        <div className="text-sm mb-1">{name}</div>
        <div className="text-xs text-muted-foreground">{code}</div>
      </div>
      <div className="ml-auto mr-7 flex flex-col items-end text-xs font-mono">
        {kdjRender(detail.kdj_week * 0.2 + detail.kdj_day * 0.8)}
        {/* {kdjRender(detail.kdj_week, 'W')} */}
        {/* {kdjRender(detail.kdj_day, 'D')} */}
        {/* {kdjRender(detail.kdj_half_hour)} */}
      </div>
      <div className="flex-none flex flex-col items-center">
        <div
          style={{
            background: `rgba(${!chg ? '100, 100, 100' : chg > 0 ? RED_RGB : GREEN_RGB}, 1)`,
          }}
          className="w-14 h-6 text-white text-xs flex justify-center items-center rounded-sm mb-1"
        >
          {chg.toFixed(2)}%
        </div>
        <div className="text-xs text-muted-foreground">{price}</div>
      </div>
    </div>
  );
});

SimpleItem.displayName = 'SimpleItem';

export const QuickNav = memo(() => {
  const history = useHistory();
  const { id: idFromParams } = useParams<{ id: string }>();

  const [type, setType] = useState('choice');
  const favStockIdList = useAtomValue(favStockIdListAtom);
  const watchIdList = useAtomValue(watchStockIdListAtom);
  const searchOpen = useAtomValue(searchOpenAtom);
  const [direction, setDirection] = useAtom(quickNavDirectionAtom);
  const [options, setOptions] = useState<FilterItem[]>([]);

  const idList = useMemo(
    () => (type === 'choice' ? favStockIdList : watchIdList),
    [type, favStockIdList, watchIdList],
  );

  const sort = useMemoizedFn((a: FilterItem, b: FilterItem, d: Direction | null) => {
    if (!d) {
      return b.totalMarketValue - a.totalMarketValue;
    }
    const computeValueWithWeight = (item: FilterItem) => item.kdj_day * 0.8 + item.kdj_week * 0.2;
    if (d === 'asc') {
      return computeValueWithWeight(a) - computeValueWithWeight(b);
    }
    return computeValueWithWeight(b) - computeValueWithWeight(a);
  });

  const { data, loading, refresh } = useLatestRequest(async () => {
    const res = await fetchFilterList(
      `${idList.map((item) => item.split('.')[1]).join(';')};周线周期KDJ(J值);日线周期KDJ(J值);30分钟线周期KDJ(J值);15分钟线周期KDJ(J值);行业`,
    );
    return res.list;
  }, [idList]);

  useEffect(() => {
    setOptions(data?.slice()?.sort((a, b) => sort(a, b, direction)) || []);
  }, [data, direction, sort]);

  const onKeyDown = useMemoizedFn((e: KeyboardEvent) => {
    const index = options.findIndex((item) => item.id === idFromParams);

    if (options.length < 1) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'ArrowUp') {
      const prev = index > 0 ? index - 1 : options.length - 1;
      history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', options[prev].id));
      document.querySelector(`[data-nav-stock-id="${options[prev].id}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      const next = index < options.length - 1 ? index + 1 : 0;
      history.push(RouterKey.CHOICE_OVERVIEW.replace(':id', options[next].id));
      document.querySelector(`[data-nav-stock-id="${options[next].id}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      e.preventDefault();
      e.stopPropagation();
    }
  });

  useEffect(() => {
    if (searchOpen) {
      return;
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown, searchOpen]);

  return (
    <div className="pb-4 h-full flex flex-col">
      <div className="flex-none px-5 pt-1 mb-1 text-sm text-muted-foreground space">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="watch">备选</SelectItem>
            <SelectItem value="choice">持有</SelectItem>
          </SelectContent>
        </Select>
        <div className="space ml-auto">
          <Button onClick={() => refresh()} size="icon" variant="ghost">
            <RotateCcw className={clsx({ 'animate-spin': loading })} />
          </Button>
          <Button
            onClick={() => {
              setDirection((pre) => (!pre ? 'desc' : pre === 'desc' ? 'asc' : null));
            }}
            size="icon"
            variant="ghost"
          >
            {!direction ? (
              <ArrowUpDown />
            ) : direction === 'asc' ? (
              <ArrowUpNarrowWide />
            ) : (
              <ArrowDownWideNarrow />
            )}
          </Button>
        </div>
      </div>
      <div className="flex-none flex px-6 mt-3 mb-1 justify-between text-sm text-muted-foreground">
        <div>名称</div>
        <div>KDJ (加权)</div>
        <div>涨跌幅</div>
      </div>
      <div className="flex-1 overflow-auto px-3">
        {options.map((detail) => (
          <SimpleItem key={detail.id} detail={detail} />
        ))}
      </div>
    </div>
  );
});

QuickNav.displayName = 'QuickNav';
