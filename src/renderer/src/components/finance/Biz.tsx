import { memo, useMemo, useState } from 'react';
import { PieChart } from '@visactor/react-vchart';
import { useTheme } from 'next-themes';
import { useAsyncEffect } from 'ahooks';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBusiness } from '@/api/finance';
import type { BizItem } from '@/types/finance';

interface BizProps {
  stockId: string;
  loading?: boolean;
}

export const Biz = memo(({ stockId, loading }: BizProps) => {
  const { theme } = useTheme();
  const [items, setItems] = useState<BizItem[] | null>(null);

  useAsyncEffect(async () => {
    const res = await fetchBusiness(stockId);
    setItems(res.bizListByProduct);
  }, [stockId]);

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return items
      .filter((item) => item.MBI_RATIO > 0.05)
      .filter((item) => !item.ITEM_NAME.startsWith('其中:'))
      .slice()
      .sort((a, b) => (b.MBI_RATIO || -1) - (a.MBI_RATIO || -1));
  }, [items]);

  const rest = useMemo<Array<BizItem>>(() => {
    if (!items) return [];
    const sm = items.filter((item) => item.MBI_RATIO <= 0.05);
    if (!sm.length) return [];
    return [
      {
        ITEM_NAME: '剩余',
        MBI_RATIO: sm.reduce((pre, cur) => pre + cur.MBI_RATIO, 0),
        GROSS_RPOFIT_RATIO:
          sm.reduce((pre, cur) => (cur.GROSS_RPOFIT_RATIO || 0) + pre, 0) / sm.length,
        SECUCODE: '',
        SECURITY_CODE: '',
        MAINOP_TYPE: '1',
        MAIN_BUSINESS_INCOME: 0,
        RANK: 1,
        REPORT_DATE: '',
      },
    ];
  }, [items]);

  if (!sortedItems || loading) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">业务分布</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  const usableItems = [...sortedItems, ...rest];
  const values = usableItems.map((item) => ({
    name: item.ITEM_NAME,
    ratio: item.MBI_RATIO,
    gpr: item.GROSS_RPOFIT_RATIO,
  }));

  return (
    <div className="h-full w-full flex flex-col">
      <div className="text-sm font-bold mb-1">业务分布</div>
      <div className="flex-1 overflow-hidden">
        <PieChart
          key={usableItems.map((item) => (item.MBI_RATIO * 100).toFixed(0)).join('-')}
          spec={{
            type: 'pie',
            padding: {
              left: 0,
              right: 0,
              top: 24,
              bottom: 24,
            },
            data: { values },
            valueField: 'ratio',
            seriesField: 'name',
            label: {
              visible: true,
              formatMethod: (
                _: unknown,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: any,
              ) => {
                return {
                  type: 'rich',
                  text: [
                    { text: `${data?.name}\n`, fontWeight: '500', fontSize: 13 },
                    {
                      text: data?.gpr ? `毛利率 ${(data.gpr * 100).toFixed(2)}%\n` : '毛利率 --\n',
                      fontSize: 10,
                      fill: theme === 'dark' ? '#ffffff66' : '#00000044',
                    },
                    {
                      text: data?.ratio ? `占比 ${(data.ratio * 100).toFixed(2)}%` : '占比 --',
                      fontSize: 10,
                      fill: theme === 'dark' ? '#ffffff66' : '#00000044',
                    },
                  ],
                };
              },
            },
            tooltip: {
              visible: true,
              mark: {
                title: {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  value: (datum: any) => datum?.name,
                },
                content: [
                  {
                    key: '毛利率',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value: (datum: any) => (datum?.gpr ? `${(datum.gpr * 100).toFixed(2)}%` : '--'),
                    hasShape: false,
                  },
                  {
                    key: '占比',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value: (datum: any) =>
                      datum?.ratio ? `${(datum.ratio * 100).toFixed(2)}%` : '--',
                    hasShape: false,
                  },
                ],
              },
            },
            animationUpdate: false,
            animationAppear: false,
            animationEnter: false,
            animationExit: false,
          }}
        />
      </div>
    </div>
  );
});
Biz.displayName = 'Biz';

export const BizWithCard = memo((props: BizProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <Biz {...props} />
    </div>
  );
});
BizWithCard.displayName = 'BizWithCard';
