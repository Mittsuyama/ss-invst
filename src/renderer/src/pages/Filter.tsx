import { memo, useEffect, useState } from 'react';
import clsx from 'clsx';
import { request } from '@renderer/lib/request';
import { RequestType } from '@shared/types/request';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

import { Detail } from '@/components/Detail';
import { useMemoizedFn } from 'ahooks';

interface Column {
  key: string;
  title: string;
}

const COLUMN_ORDER = [
  'SERIAL',
  'SECURITY_CODE',
  'SECURITY_SHORT_NAME',
  'KDJ_J',
  'NEWEST_PRICE',
  'CHG',
  'PETTMDEDUCTED',
  'ROE_WEIGHT',
  'PB',
  'TOAL_MARKET_VALUE',
  'TRADING_VOLUMES',
  'TURNOVER_RATE',
];

const CONDITION =
  '市盈率TTM(扣非)大于等于0倍小于等于30倍;净资产收益率ROE(加权)>10%;日线周期KDJ(J值)<30;30分钟线周期KDJ(J值)<30;上市时间>2年';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataRecord = Record<string, any>;

export const Filter = memo(() => {
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    pageSize: 50,
    page: 1,
  });
  const [total, setTotal] = useState(0);
  const [columns, setColumns] = useState<Column[]>([]);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [current, setCurrent] = useState<DataRecord | null>(null);
  const [currentId, setCurrentId] = useState('');
  const [currentIdLoading, setCurrentIdLoading] = useState(false);

  const maxPage = Math.floor((total - 1) / pagination.pageSize) + 1;
  const beforeCurrent = pagination.page - 1 - 1 > 3 ? 2 : Math.max(0, pagination.page - 1 - 1);
  const afterCurrent =
    maxPage - pagination.page - 1 > 3 ? 2 : Math.max(0, maxPage - pagination.page - 1);

  const fetch = useMemoizedFn(async (page: number, pageSize: number) => {
    try {
      const lastIndex = records.findIndex((item) => item.SECURITY_CODE === current?.SECURITY_CODE);
      setLoading(true);
      const res = await request(
        RequestType.POST,
        'https://np-tjxg-g.eastmoney.com/api/smart-tag/stock/v3/pw/search-code',
        {
          pageSize: pageSize,
          pageNo: page,
          fingerprint: 'f95cc8cd33dbefa5237c65ac21b3c1b3',
          biz: 'web_ai_select_stocks',
          keyWordNew: CONDITION,
          // customDataNew: '[{"type":"text","value":"日线周期KDJ(J值)<5;总市值>100亿;","extra":""}]',
        },
      );
      setColumns(
        res.data.result.columns
          .filter((item) => COLUMN_ORDER.some((c) => item.key.startsWith(c)))
          .sort((a, b) => {
            const aIndex = COLUMN_ORDER.findIndex((c) => a.key.startsWith(c));
            const bIndex = COLUMN_ORDER.findIndex((c) => b.key.startsWith(c));
            return aIndex - bIndex;
          }),
      );
      setTotal(res.data.result.total);
      const list = res.data.result.dataList;
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
    const index = records.findIndex((item) => item.SECURITY_CODE === current?.SECURITY_CODE);
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
    const index = records.findIndex((item) => item.SECURITY_CODE === current?.SECURITY_CODE);
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
      if (e.key === 'ArrowLeft') {
        onPrevious();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [current, onNext, onPrevious]);

  useEffect(() => {
    const code = current?.SECURITY_CODE;
    if (!code) {
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
            keyword: code,
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

  return (
    <>
      <div
        className={clsx('h-full p-6 pt-0 flex flex-col', {
          'pointer-events-none opacity-40': loading,
        })}
      >
        <div className="space mb-4 px-1 flex-none">
          <div className="font-bold mr-4">条件选股</div>
          <div className="text-sm text-muted-foreground pl-1">{CONDITION}</div>
          <div className="ml-auto">
            <Button onClick={() => fetch(pagination.page, pagination.pageSize)} variant="outline">
              <RotateCcw />
              刷新
            </Button>
          </div>
        </div>
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
                  <TableRow key={record.SECURITY_CODE}>
                    {columns.map((col) => {
                      if (!['SECURITY_SHORT_NAME'].includes(col.key)) {
                        return <TableCell key={col.key}> {record[col.key]} </TableCell>;
                      }
                      return (
                        <TableCell key={col.key}>
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
          className="flex flex-col"
          style={{ width: 'calc(100% - 260px)', maxWidth: '100%' }}
        >
          <div className="flex-none flex items-center p-6">
            <DrawerHeader className="flex p-0">
              <DrawerTitle className="mb-0">查看详情</DrawerTitle>
              {/* <DrawerDescription className="mb-0"></DrawerDescription> */}
            </DrawerHeader>
            <div className="flex gap-5 items-center ml-auto">
              <Button variant="outline" onClick={onPrevious}>
                <ChevronLeft className="" />
                上一个
              </Button>
              <div>{current?.SECURITY_SHORT_NAME}</div>
              <Button variant="outline" onClick={onNext}>
                下一个
                <ChevronRight className="" />
              </Button>
            </div>
          </div>
          <div className={clsx('flex-1 overflow-hidden px-6', { 'opacity-25': currentIdLoading })}>
            {currentId ? <Detail className="h-full" id={currentId} /> : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
});

Filter.displayName = 'Filter';
