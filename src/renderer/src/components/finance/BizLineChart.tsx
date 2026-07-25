import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { formatFinancialNumber } from '@/lib/finance';
import type { BizItemData } from '@/types/stock-extra';
import type { ReportMonth } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface BizLineChartProps {
  bizItems: BizItemData[];
  month: ReportMonth;
}

export const BizLineChart = memo(({ bizItems, month }: BizLineChartProps) => {
  const sortedBizItems = useMemo(() => {
    const years = [...new Set(bizItems.map((item) => item.year))].sort((a, b) => b - a).slice(0, 1);
    const newList = bizItems.filter((item) => years.includes(item.year));
    newList.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return b.ratio - a.ratio;
    });
    return newList;
  }, [bizItems]);

  const values = useMemo(() => {
    const items = bizItems.filter((item) => item.month === month);
    const reverseItems = items.slice().reverse();
    return bizItems.slice().sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const aIncome = reverseItems.find((item) => item.name === a.name)?.income || 0;
      const bIncome = reverseItems.find((item) => item.name === b.name)?.income || 0;
      return aIncome - bIncome;
    });
  }, [bizItems, month]);

  if (!bizItems.length) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">历史业务占比</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <VChart
      key={sortedBizItems.map((item) => (item.ratio * 100).toFixed(0)).join('-')}
      spec={{
        type: 'bar',
        title: { text: '历史业务占比', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        data: { values },
        stack: true,
        xField: 'year',
        yField: 'income',
        seriesField: 'name',
        padding: [0],
        axes: [
          {
            orient: 'left',
            grid: { style: { strokeOpacity: 0.3 } },
            label: { formatMethod: (val: string) => formatFinancialNumber(val) },
          },
          { orient: 'bottom', trimPadding: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        tooltip: {
          confine: false,
          mark: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: { value: (datum: any) => `${datum?.year} 年` },
            content: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              key: (datum: any) => datum?.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              value: (datum: any) =>
                `${formatFinancialNumber(datum?.income)} (GPR: ${formatFinancialNumber(datum?.gpr * 100, { unit: '%' })}, Rate: ${formatFinancialNumber(datum?.ratio * 100, { unit: '%' })})`,
            },
          },
          dimension: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: { value: (datum: any) => `${datum?.year} 年` },
            content: [
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                key: (datum: any) => datum?.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (datum: any) =>
                  `${formatFinancialNumber(datum?.income)} (GPR: ${formatFinancialNumber(datum?.gpr * 100, { unit: '%' })})`,
              },
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateContent: (pre: any) => pre?.slice()?.reverse(),
          },
        },
        animationUpdate: false,
        animationAppear: false,
        animationEnter: false,
        animationExit: false,
      }}
    />
  );
});
BizLineChart.displayName = 'BizLineChart';

export const BizLineChartWithCard = memo((props: BizLineChartProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <BizLineChart {...props} />
    </div>
  );
});
BizLineChartWithCard.displayName = 'BizLineChartWithCard';
