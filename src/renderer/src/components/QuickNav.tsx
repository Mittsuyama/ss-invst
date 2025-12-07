import { memo, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useHistory, useParams } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { AreaChart } from '@visactor/react-vchart';
import { listGetRequest } from '@/lib/request';
import { GREEN_RGB, RED_RGB } from '@/lib/constants';
import { HistoryOption } from '@renderer/types/search';
import { fetchTrends } from '@renderer/api/klines';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { favStockIdListAtom } from '@renderer/models/detail';

const SAMPLE_RATE = 10;

const NavItem = memo((props: HistoryOption) => {
  const { id: idFromParams } = useParams<{ id: string }>();
  const { id, title } = props;
  const history = useHistory();

  const [lines, setLines] = useState<PriceAndVolumeItem[] | null>(null);
  const last = lines?.at(-1);

  useEffect(() => {
    let didCancel = false;
    (async () => {
      const list = await fetchTrends(id);
      if (didCancel) {
        return;
      }
      setLines(list);
    })();
    return () => {
      didCancel = true;
    };
  }, [id]);

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
      className={clsx('flex px-2 py-2 my-0.5 gap-3 rounded-md items-center cursor-default', {
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
                  dayjs(item.timestamp).minute() % SAMPLE_RATE ===
                  dayjs(last?.timestamp || 0).minute() % SAMPLE_RATE,
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
          background: `rgba(${diff.rate > 0 ? RED_RGB : GREEN_RGB}, 1)`,
        }}
        className="w-14 h-6 text-white text-xs flex justify-center items-center rounded-sm"
      >
        {parseFloat((diff.rate * 100).toFixed(2))}%
      </div>
    </div>
  );
});

NavItem.displayName = 'NavItem';

export const QuickNav = memo(() => {
  // const historyOptions = useAtomValue(historySearchOptionsAtom);
  const favStockIdList = useAtomValue(favStockIdListAtom);
  const [options, setOptions] = useState<HistoryOption[]>([]);

  useEffect(() => {
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
      setOptions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.map((item: any, index) => {
          const data = item?.result?.[0];
          return {
            type: 'sec',
            title: data?.shortName || '',
            id: favStockIdList[index],
          };
        }),
      );
    })();
  }, [favStockIdList]);

  return (
    <div className="pl-3 pr-4">
      <div className="px-2 text-sm text-muted-foreground">最近访问</div>
      {options.map((option) => (
        <NavItem key={option.id} {...option} />
      ))}
    </div>
  );
});

QuickNav.displayName = 'QuickNav';
