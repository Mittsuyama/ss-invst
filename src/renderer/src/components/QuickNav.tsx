import { memo, useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useHistory, useParams } from 'react-router-dom';
import { RotateCcw, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { AreaChart } from '@visactor/react-vchart';
import { listGetRequest } from '@/lib/request';
import { GREEN_RGB, RED_RGB } from '@/lib/constants';
import { HistoryOption } from '@renderer/types/search';
import { fetchTrendsList } from '@renderer/api/klines';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { favStockIdListAtom, quickNavDirectionAtom } from '@renderer/models/detail';
import { Button } from '@/components/ui/button';
import { Direction } from '@shared/types/meta';

interface NavItemProps {
  detail: HistoryOption;
  lines: PriceAndVolumeItem[];
}

const SAMPLE_GAP = 5;

const getRate = (lines: PriceAndVolumeItem[]) => {
  const open = lines[0].open;
  const close = lines[lines.length - 1].close;
  const rate = (close - open) / open;
  return rate;
};

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
      onClick={() => history.push(`/detail/${id}`)}
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

interface Item {
  lines: PriceAndVolumeItem[];
  detail: HistoryOption;
}

export const QuickNav = memo(() => {
  const favStockIdList = useAtomValue(favStockIdListAtom);
  const [direction, setDirection] = useAtom(quickNavDirectionAtom);
  const [options, setOptions] = useState<HistoryOption[]>([]);
  const [list, setList] = useState<Array<Item>>([]);
  const [loading, setLoading] = useState(false);

  const sort = useMemoizedFn((a: Item, b: Item, d: Direction | null) => {
    if (!d) {
      return (
        favStockIdList.findIndex((id) => id === a.detail.id) -
        favStockIdList.findIndex((id) => id === b.detail.id)
      );
    }
    if (d === 'asc') {
      return getRate(a.lines) - getRate(b.lines);
    }
    return getRate(b.lines) - getRate(a.lines);
  });

  const fetchList = useMemoizedFn(async (o: HistoryOption[]) => {
    if (!o.length) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetchTrendsList(o.map((item) => item.id));
      setList(
        res
          .map((lines, index) => ({ lines, detail: options[index] }))
          .sort((a, b) => sort(a, b, direction)),
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    fetchList(options);
  }, [options, fetchList]);

  useEffect(() => {
    let didCancel = false;
    (async () => {
      const res = await listGetRequest(
        favStockIdList.map((id) => ({
          url: 'https://search-codetable.eastmoney.com/codetable/search/web',
          params: {
            client: 'web',
            keyword: id.split('.')[1],
            pageIndex: 1,
            pageSize: 1,
          },
        })),
      );
      if (didCancel) {
        return;
      }
      setOptions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.map((item: any, index) => {
          const data = item?.result?.[0];
          return {
            type: 'sec',
            title: data?.shortName || '',
            id: favStockIdList[index],
            ...data,
          };
        }),
      );
    })();
    return () => {
      didCancel = true;
    };
  }, [favStockIdList]);

  return (
    <div className="pl-3 pr-4 pb-4">
      <div className="px-3 mb-1 text-sm text-muted-foreground space">
        <div>自选股</div>
        <div className="space ml-auto">
          <Button onClick={() => fetchList(options)} size="icon" variant="ghost">
            <RotateCcw className={clsx({ 'animate-spin': loading })} />
          </Button>
          <Button
            onClick={() => {
              const d = !direction ? 'desc' : direction === 'desc' ? 'asc' : null;
              setDirection(d);
              setList(list.slice().sort((a, b) => sort(a, b, d)));
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
      {list.map(({ detail, lines }) => (
        <NavItem key={detail.id} detail={detail} lines={lines} />
      ))}
    </div>
  );
});

QuickNav.displayName = 'QuickNav';
