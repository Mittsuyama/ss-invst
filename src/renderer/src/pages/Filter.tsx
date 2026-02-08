import { memo, useEffect, useMemo, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import clsx from 'clsx';
import { request } from '@renderer/lib/request';
import { RequestType } from '@shared/types/request';
import { MoreHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Detail } from '@/components/Detail';
import { fetchFilterList } from '@renderer/api/stock';
import { FilterColumn, FilterItem } from '@renderer/types/search';

const COLUMN_ORDER = [
  '^SERIAL',
  '^SECURITY_CODE',
  '^SECURITY_SHORT_NAME',
  '^INDUSTRY',
  '^KDJ_J',
  '^NEWEST_PRICE',
  '^CHG',
  '^PETTMDEDUCTED',
  // '^ROE_WEIGHT{.+}$',
  '^PB',
  '^TOAL_MARKET_VALUE',
  '^TRADING_VOLUMES',
  '^TURNOVER_RATE',
];

// const CONDITION =
//   '市盈率TTM(扣非)大于等于0倍小于等于30倍;净资产收益率ROE(加权)>10%;日线周期KDJ(J值)<30;上市时间>2年;总市值>50亿;行业';
const CONDITION = '市盈率TTM(扣非);日线周期KDJ(J值)<5;总市值>50亿;行业';

export const Filter = memo(() => {
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    pageSize: 50,
    page: 1,
  });
  const [total, setTotal] = useState(0);
  const [columns, setColumns] = useState<FilterColumn[]>([]);
  const [records, setRecords] = useState<FilterItem[]>([]);
  const [current, setCurrent] = useState<FilterItem | null>(null);
  const [currentId, setCurrentId] = useState('');
  const [currentIdLoading, setCurrentIdLoading] = useState(false);

  const maxPage = Math.floor((total - 1) / pagination.pageSize) + 1;
  const beforeCurrent = pagination.page - 1 - 1 > 3 ? 2 : Math.max(0, pagination.page - 1 - 1);
  const afterCurrent =
    maxPage - pagination.page - 1 > 3 ? 2 : Math.max(0, maxPage - pagination.page - 1);

  const fetch = useMemoizedFn(async (page: number, pageSize: number) => {
    try {
      const lastIndex = records.findIndex((item) => item.id === current?.id);
      setLoading(true);
      const { list, total, columns } = await fetchFilterList(CONDITION, { page, pageSize });
      setColumns(
        columns
          .filter((item) => COLUMN_ORDER.some((c) => new RegExp(c).test(item.key)))
          .sort((a, b) => {
            const aIndex = COLUMN_ORDER.findIndex((c) => new RegExp(c).test(a.key));
            const bIndex = COLUMN_ORDER.findIndex((c) => new RegExp(c).test(b.key));
            return aIndex - bIndex;
          }),
      );
      setTotal(total);
      setRecords(list);
      if (current && list?.length) {
        if (lastIndex === 0) {
          setCurrent(list[list.length - 1]);
        } else {
          setCurrent(list[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  });

  const onPrevious = useMemoizedFn(() => {
    const index = records.findIndex((item) => item.id === current?.id);
    if (index === -1) {
      return;
    }
    if (index !== 0) {
      setCurrent(records[index - 1]);
    } else if (pagination.page > 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  });

  const onNext = useMemoizedFn(() => {
    const index = records.findIndex((item) => item.id === current?.id);
    if (index === -1) {
      return;
    }
    if (index !== records.length - 1) {
      setCurrent(records[index + 1]);
    } else if (pagination.page < maxPage) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        onPrevious();
      } else if (e.key === 'ArrowDown') {
        onNext();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [current, onNext, onPrevious]);

  useEffect(() => {
    if (!current?.code) {
      return;
    }
    (async () => {
      try {
        setCurrentIdLoading(true);
        const res = await request(
          RequestType.GET,
          'https://search-codetable.eastmoney.com/codetable/search/web',
          {
            client: 'web',
            keyword: current.code,
            pageIndex: 1,
            pageSize: 20,
          },
        );
        if (res.result?.length) {
          setCurrentId(`${res.result[0].market}.${res.result[0].code}`);
        }
      } finally {
        setCurrentIdLoading(false);
      }
    })();
  }, [current]);

  useEffect(() => {
    fetch(pagination.page, pagination.pageSize);
  }, [pagination, fetch]);

  const paginationItemRender = (page: number) => (
    <PaginationItem key={page}>
      <PaginationLink
        isActive={pagination.page === page}
        onClick={() => setPagination((prev) => ({ ...prev, page }))}
      >
        {page}
      </PaginationLink>
    </PaginationItem>
  );

  const bizList = useMemo(() => {
    const industryMap = new Map<string, number>();
    records.forEach((record) => {
      const industry = record.biz;
      if (industryMap.has(industry)) {
        industryMap.set(industry, industryMap.get(industry)! + 1);
      } else {
        industryMap.set(industry, 1);
      }
    });
    return Array.from(industryMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  return (
    <>
      <div
        className={clsx('h-full p-6 pt-0 flex flex-col', {
          'pointer-events-none opacity-40': loading,
        })}
      >
        <div className="space mb-2 px-1 flex-none">
          <div className="font-bold mr-4">条件选股</div>
          <div className="text-sm text-muted-foreground pl-1">{CONDITION}</div>
          <div className="ml-auto">
            <Button onClick={() => fetch(pagination.page, pagination.pageSize)} variant="outline">
              <RotateCcw />
              刷新
            </Button>
          </div>
        </div>
        {!!records && (
          <div className="flex-none flex gap-4 items-center mb-4 text-muted-foreground text-sm">
            <div className="flex gap-2 items-center">
              <div>总数</div>
              <div>{total}</div>
            </div>
            <div>|</div>
            <div>当前页</div>
            {bizList
              .filter(([, count]) => count >= 3)
              .map(([biz, count]) => (
                <div key={biz} className="flex gap-2 items-center">
                  <div>{biz}</div>
                  <div>{count}</div>
                </div>
              ))}
            {bizList.some(([, count]) => count < 3) && (
              <div className="flex gap-2 items-center">
                <MoreHorizontal size={16} />
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <div className="p-4 border rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key}>{col.title.replace(/\(.*?不复权\)/, '')}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    {columns.map((col) => {
                      if (!['SECURITY_SHORT_NAME'].includes(col.key)) {
                        return <TableCell key={col.key}>{record[col.key]}</TableCell>;
                      }
                      return (
                        <TableCell key={`${record.id}-${col.key}`}>
                          <div
                            onClick={() => setCurrent(record)}
                            className="text-slate-500 hover:opacity-60 hover:cursor-pointer"
                          >
                            {record[col.key]}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total && maxPage > 1 ? (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem className={clsx({ 'cursor-not-allowed': pagination.page === 1 })}>
                  <PaginationPrevious
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    className={clsx({ 'pointer-events-none': pagination.page === 1 })}
                  />
                </PaginationItem>
                {paginationItemRender(1)}

                {pagination.page - 1 - 1 > 3 ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}

                {Array.from({ length: beforeCurrent })
                  .fill(0)
                  .map((_, index) => paginationItemRender(pagination.page - beforeCurrent + index))}

                {pagination.page !== 1 && pagination.page !== maxPage
                  ? paginationItemRender(pagination.page)
                  : null}

                {Array.from({ length: afterCurrent })
                  .fill(0)
                  .map((_, index) => paginationItemRender(pagination.page + index + 1))}

                {maxPage - pagination.page - 1 > 3 ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}

                {paginationItemRender(maxPage)}
                <PaginationItem
                  className={clsx({
                    'cursor-not-allowed': pagination.page === maxPage,
                  })}
                >
                  <PaginationNext
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    className={clsx({
                      'pointer-events-none': pagination.page === maxPage,
                    })}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      </div>
      <Drawer open={!!current} onClose={() => setCurrent(null)} direction="right">
        <DrawerContent
          className="flex flex-col ring-0 outline-0"
          style={{ width: 'calc(100% - 260px)', maxWidth: '100%' }}
        >
          <div
            className={clsx('flex-1 overflow-hidden px-6 pt-5', { 'opacity-25': currentIdLoading })}
          >
            {currentId ? (
              <Detail
                sidebar
                className="h-full"
                id={currentId}
                // headerExtra={
                //   <ButtonGroup className="text-sm">
                //     <Button variant="outline" onClick={onPrevious}>
                //       <ChevronLeft className="" />
                //       上一个
                //     </Button>
                //     <Button variant="outline" onClick={onNext}>
                //       下一个
                //       <ChevronRight className="" />
                //     </Button>
                //   </ButtonGroup>
                // }
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
});

Filter.displayName = 'Filter';
