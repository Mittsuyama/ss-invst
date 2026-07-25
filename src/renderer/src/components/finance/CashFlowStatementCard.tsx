import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { typeToCashFlowItems } from '@/lib/account-items';
import { getNumberInReport, formatFinancialNumber } from '@/lib/finance';
import type { CashFlowStatementType, FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface CashFlowStatementCardProps {
  type: CashFlowStatementType;
  reports?: FinancialReport[];
}

export const CashFlowStatementCard = memo(({ type, reports }: CashFlowStatementCardProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const values = useMemo(() => {
    if (!reversedReports) return [];
    const config = typeToCashFlowItems[type];
    const allKeys = [
      ...config.positive.map((k) => ({ key: k, group: 'positive' as const })),
      ...config.negative.map((k) => ({ key: k, group: 'negative' as const })),
      { key: config.rest, group: 'rest' as const },
    ];

    return reversedReports.flatMap((report) =>
      allKeys.map(({ key, group }) => {
        const rawValue = getNumberInReport(report.data, key);
        const value = group === 'negative' ? (rawValue ? rawValue * -1 : 0) : rawValue;
        return {
          year: report.year,
          name: key.split('-').slice(-1)[0],
          rawValue,
          value,
          group,
        };
      }),
    );
  }, [reversedReports, type]);

  if (!reversedReports) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">
          现金流·{`${type[0].toUpperCase()}${type.slice(1)}`}
        </div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <VChart
      key={
        reversedReports[0]
          ? getNumberInReport(reversedReports[0].data, 'x-jyhdcsdxjllje-经营活动产生的现金流量净额')
          : 'empty'
      }
      spec={{
        type: 'line',
        title: {
          text: `现金流·${type[0].toUpperCase()}${type.slice(1)}`,
          textStyle: { fontSize: 14, fontWeight: 'bold' },
        },
        padding: [0],
        data: { values },
        xField: 'year',
        yField: 'value',
        seriesField: 'name',
        point: { visible: false },
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
          visible: true,
          dimension: {
            title: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              value: (datum: any) => `${datum?.year} 年`,
            },
            content: [
              {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                key: (datum: any) => datum?.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (datum: any) => formatFinancialNumber(datum?.rawValue),
              },
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateContent: (pre: any) =>
              pre?.slice()?.sort(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (a: any, b: any) => Number(b?.datum?.rawValue) - Number(a?.datum?.rawValue),
              ),
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
CashFlowStatementCard.displayName = 'CashFlowStatementCard';

export const CashFlowStatementCardWithCard = memo((props: CashFlowStatementCardProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <CashFlowStatementCard {...props} />
    </div>
  );
});
CashFlowStatementCardWithCard.displayName = 'CashFlowStatementCardWithCard';
