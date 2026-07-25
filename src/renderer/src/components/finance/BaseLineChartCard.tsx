import { memo, useMemo, type ReactNode } from 'react';
import { VChart } from '@visactor/react-vchart';
import { ACCOUNT_ITEM } from '@/lib/account-items';
import { getNumberInReport, formatFinancialNumber } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface BaseLineChartCardProps {
  title: ReactNode;
  reports?: FinancialReport[];
  accountItemKeys: Array<keyof typeof ACCOUNT_ITEM>;
}

export const BaseLineChartCard = memo(
  ({ title, reports, accountItemKeys }: BaseLineChartCardProps) => {
    const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

    const values = useMemo(() => {
      if (!reversedReports) return [];
      return reversedReports.flatMap((report) =>
        accountItemKeys.map((key) => ({
          year: report.year,
          type: key.split('-').slice(-1)[0],
          value: getNumberInReport(report.data, key),
        })),
      );
    }, [reversedReports, accountItemKeys]);

    const titleStr = typeof title === 'string' ? title : '';

    if (!reversedReports) {
      return (
        <div className="h-full flex flex-col rounded-lg border p-2">
          <div className="text-sm font-bold mb-2">{title}</div>
          <Skeleton className="flex-1 w-full" />
        </div>
      );
    }

    return (
      <VChart
        key={
          reversedReports[0]
            ? getNumberInReport(reversedReports[0].data, 'z-zczj-资产总计')
            : 'empty'
        }
        spec={{
          type: 'line',
          title: { text: titleStr, textStyle: { fontSize: 14, fontWeight: 'bold' } },
          padding: [0],
          data: { values },
          xField: 'year',
          yField: 'value',
          seriesField: 'type',
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
                  key: (datum: any) => datum?.type,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  value: (datum: any) => formatFinancialNumber(datum?.value),
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              updateContent: (pre: any) =>
                pre?.slice()?.sort(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (a: any, b: any) => Number(b?.datum?.value) - Number(a?.datum?.value),
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
  },
);
BaseLineChartCard.displayName = 'BaseLineChartCard';
