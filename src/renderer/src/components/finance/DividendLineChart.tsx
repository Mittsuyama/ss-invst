import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import type { DividendItem } from '@/types/stock-extra';
import { Skeleton } from '@/components/ui/skeleton';

interface DividendLineChartProps {
  dividentItems: DividendItem[];
}

export const DividendLineChart = memo(({ dividentItems }: DividendLineChartProps) => {
  const values = useMemo(() => {
    const divs = dividentItems.map((item) => ({
      value: item.DIVIDEND_RATIO_YSS,
      type: '股息率',
      date: item.TRADE_DATE,
    }));
    const money = dividentItems.map((item) => ({
      value: item.YIELD_7DAYS,
      type: '货币基金收益率',
      date: item.TRADE_DATE,
    }));
    return [...divs, ...money];
  }, [dividentItems]);

  if (!dividentItems.length) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">分红历史走势（含预案）</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <VChart
      key={`${dividentItems[dividentItems.length - 1].SECURITY_CODE}-${dividentItems[dividentItems.length - 1].TRADE_DATE}`}
      spec={{
        type: 'line',
        title: { text: '分红历史走势（含预案）', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        padding: [0],
        color: ['#FC3727AA', '#94EFFF77'],
        data: { values },
        axes: [
          { orient: 'left', grid: { style: { strokeOpacity: 0.3 } } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        xField: 'date',
        yField: 'value',
        seriesField: 'type',
        point: { visible: false },
        tooltip: {
          visible: true,
          dimension: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            title: { value: (datum: any) => datum?.date },
            content: [
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                key: (datum: any) => datum?.type,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (datum: any) =>
                  datum?.value ? `${datum.value.toFixed(2)}%` : datum?.value || '--',
              },
            ],
          },
        },
        line: { style: { curveType: 'monotone' } },
        animationUpdate: false,
        animationAppear: false,
        animationEnter: false,
        animationExit: false,
      }}
    />
  );
});
DividendLineChart.displayName = 'DividendLineChart';

export const DividendLineChartWithCard = memo((props: DividendLineChartProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <DividendLineChart {...props} />
    </div>
  );
});
DividendLineChartWithCard.displayName = 'DividendLineChartWithCard';
