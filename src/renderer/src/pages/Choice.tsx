import { memo, useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import clsx from 'clsx';
import { useAtomValue } from 'jotai';
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  BriefcaseBusiness,
  Eye,
  Gem,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';
import { GREEN_COLOR, RED_COLOR } from '@/lib/constants';
import { buildConditionStockQuery } from '@/lib/condition-stock';
import { fetchConditionStockList } from '@renderer/api/stock';
import {
  favStockIdListAtom,
  qualityStockIdListAtom,
  watchStockIdListAtom,
} from '@renderer/models/detail';
import { FilterItem } from '@renderer/types/search';
import { StockDetailDrawer } from '@/components/StockDetailDrawer';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const favoriteTypes = [
  { value: 'watch', label: '关注', Icon: Eye },
  { value: 'hold', label: '持有', Icon: BriefcaseBusiness },
  { value: 'quality', label: '优质', Icon: Gem },
] as const;

type FavoriteType = (typeof favoriteTypes)[number]['value'];
type SortDirection = 'asc' | 'desc' | null;
type SortKey = 'chg' | 'kdj_day' | 'kdj_week' | 'weightedKdj';

const sortConfigs: Record<SortKey, { label: string; getValue: (item: FilterItem) => number }> = {
  chg: { label: '涨跌幅', getValue: (item) => item.chg },
  kdj_day: { label: 'KDJ(日)', getValue: (item) => item.kdj_day },
  kdj_week: { label: 'KDJ(周)', getValue: (item) => item.kdj_week },
  weightedKdj: {
    label: '加权KDJ',
    getValue: (item) => item.kdj_day * 0.8 + item.kdj_week * 0.2,
  },
};

export const Choice = memo(() => {
  const watchIdList = useAtomValue(watchStockIdListAtom);
  const holdIdList = useAtomValue(favStockIdListAtom);
  const qualityIdList = useAtomValue(qualityStockIdListAtom);

  const [favoriteType, setFavoriteType] = useState<FavoriteType>('hold');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<FilterItem[]>([]);
  const [current, setCurrent] = useState<FilterItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('chg');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const idList = useMemo(() => {
    switch (favoriteType) {
      case 'watch':
        return watchIdList;
      case 'quality':
        return qualityIdList;
      default:
        return holdIdList;
    }
  }, [favoriteType, holdIdList, qualityIdList, watchIdList]);

  const isEmpty = idList.length < 1;

  const fetchRecords = useMemoizedFn(async () => {
    if (isEmpty) {
      setRecords([]);
      return;
    }
    try {
      setLoading(true);
      const { list } = await fetchConditionStockList(
        buildConditionStockQuery(idList, [
          '周线周期KDJ(J值)',
          '日线周期KDJ(J值)',
          '30分钟线周期KDJ(J值)',
          '15分钟线周期KDJ(J值)',
          'PE(TTM)',
          'PB',
          '股息率',
        ]),
      );
      setRecords(list);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, idList]);

  useEffect(() => {
    if (isEmpty) {
      return;
    }
    const timer = window.setInterval(() => {
      fetchRecords();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [fetchRecords, isEmpty]);

  const sortedRecords = useMemo(() => {
    const sortConfig = sortConfigs[sortKey];
    return records.slice().sort((a, b) => {
      if (!sortDirection) {
        return idList.indexOf(a.id) - idList.indexOf(b.id);
      }
      const diff = sortConfig.getValue(a) - sortConfig.getValue(b);
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [idList, records, sortDirection, sortKey]);

  const onSort = useMemoizedFn((key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('desc');
      return;
    }
    setSortDirection((prev) => (!prev ? 'desc' : prev === 'desc' ? 'asc' : null));
  });

  const sortIconRender = (key: SortKey) => {
    if (sortKey !== key || !sortDirection) {
      return <ArrowUpDown className="size-4" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUpNarrowWide className="size-4" />
    ) : (
      <ArrowDownWideNarrow className="size-4" />
    );
  };

  const numberCellRender = (value: number, fractionDigits = 2, suffix = '') => {
    if (Number.isNaN(value)) {
      return '-';
    }
    return `${value.toFixed(fractionDigits)}${suffix}`;
  };

  const kdjCellRender = (value: number) => {
    if (Number.isNaN(value)) {
      return '-';
    }

    const isHigh = value > 85;
    const isLow = value < 5;

    return (
      <div
        className="inline-flex items-center gap-1"
        style={isHigh ? { color: RED_COLOR } : isLow ? { color: GREEN_COLOR } : undefined}
      >
        <span>{value.toFixed(1)}</span>
        {isHigh ? <span style={{ color: RED_COLOR }}>▲</span> : null}
        {isLow ? <span style={{ color: GREEN_COLOR }}>▼</span> : null}
      </div>
    );
  };

  const currentIndex = records.findIndex((item) => item.id === current?.id);

  const onPrevious = useMemoizedFn(() => {
    if (currentIndex < 1) {
      return;
    }
    setCurrent(records[currentIndex - 1]);
  });

  const onNext = useMemoizedFn(() => {
    if (currentIndex === -1 || currentIndex >= records.length - 1) {
      return;
    }
    setCurrent(records[currentIndex + 1]);
  });

  return (
    <>
      <div className="h-full px-4 pb-4 flex flex-col">
        <div className="flex-none flex items-center gap-3 mb-4">
          <div className="font-bold text-base">收藏夹</div>
          <Select
            value={favoriteType}
            onValueChange={(value) => setFavoriteType(value as FavoriteType)}
          >
            <SelectTrigger className="w-32" size="sm">
              <SelectValue placeholder="收藏夹" />
            </SelectTrigger>
            <SelectContent>
              {favoriteTypes.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">共 {idList.length} 只</div>
          <Button className="ml-auto" size="sm" variant="outline" onClick={() => fetchRecords()}>
            <RotateCcw className={clsx(loading && 'animate-spin')} />
            刷新
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-2xl px-4 py-3">
          {loading && records.length < 1 ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-md px-2 py-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-16" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-muted-foreground">
              <FolderOpen className="mb-3 size-8" />
              <div className="text-sm">当前收藏夹还是空的</div>
              <div className="mt-1 text-xs">先去详情页把股票加入这个收藏夹</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-background">
                  <TableHead>名称</TableHead>
                  <TableHead>代码</TableHead>
                  <TableHead>最新价</TableHead>
                  <TableHead>
                    <div
                      className="h-full flex gap-1 items-center hover:bg-secondary cursor-default"
                      onClick={() => onSort('chg')}
                    >
                      涨跌幅
                      {sortIconRender('chg')}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div
                      className="h-full flex gap-1 items-center hover:bg-secondary cursor-default"
                      onClick={() => onSort('weightedKdj')}
                    >
                      加权KDJ
                      {sortIconRender('weightedKdj')}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div
                      className="h-full flex gap-1 items-center hover:bg-secondary cursor-default"
                      onClick={() => onSort('kdj_day')}
                    >
                      KDJ(日)
                      {sortIconRender('kdj_day')}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div
                      className="h-full flex gap-1 items-center hover:bg-secondary cursor-default"
                      onClick={() => onSort('kdj_week')}
                    >
                      KDJ(周)
                      {sortIconRender('kdj_week')}
                    </div>
                  </TableHead>
                  <TableHead>PB</TableHead>
                  <TableHead>PE(TTM)</TableHead>
                  <TableHead>股息率</TableHead>
                  <TableHead className="text-right">总市值(亿)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record) => {
                  const weightedKdj = record.kdj_day * 0.8 + record.kdj_week * 0.2;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div
                          className="text-slate-500 hover:opacity-60 hover:cursor-pointer"
                          onClick={() => setCurrent(record)}
                        >
                          {record.name}
                        </div>
                      </TableCell>
                      <TableCell>{record.code}</TableCell>
                      <TableCell>{numberCellRender(record.price)}</TableCell>
                      <TableCell
                        className={clsx({
                          'text-red-500': !Number.isNaN(record.chg) && record.chg > 0,
                          'text-green-500': !Number.isNaN(record.chg) && record.chg < 0,
                        })}
                      >
                        {numberCellRender(record.chg, 2, '%')}
                      </TableCell>
                      <TableCell>{kdjCellRender(weightedKdj)}</TableCell>
                      <TableCell>{kdjCellRender(record.kdj_day)}</TableCell>
                      <TableCell>{kdjCellRender(record.kdj_week)}</TableCell>
                      <TableCell>{numberCellRender(record.pb ?? Number.NaN)}</TableCell>
                      <TableCell>{numberCellRender(record.peTtm ?? Number.NaN)}</TableCell>
                      <TableCell>
                        {numberCellRender(record.dividend ?? Number.NaN, 2, '%')}
                      </TableCell>
                      <TableCell className="text-right">
                        {numberCellRender(record.totalMarketValue, 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      <StockDetailDrawer
        open={!!current}
        onClose={() => setCurrent(null)}
        id={current?.id}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled={currentIndex < 1}
        nextDisabled={currentIndex === -1 || currentIndex >= records.length - 1}
      />
    </>
  );
});

Choice.displayName = 'Choice';
