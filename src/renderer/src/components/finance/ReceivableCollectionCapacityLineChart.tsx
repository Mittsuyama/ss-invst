import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { getNumberInReport, formatFinancialNumber } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface ReceivableCollectionCapacityLineChartProps {
  reports?: FinancialReport[];
}

export const ReceivableCollectionCapacityLineChart = memo(
  ({ reports }: ReceivableCollectionCapacityLineChartProps) => {
    const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

    const values = useMemo(() => {
      if (!reversedReports) return [];
      const i = reversedReports.map((report) => ({
        year: report.year,
        type: '应收账款周转天数',
        value: getNumberInReport(report.data, 'leading-yszkzzts-应收账款周转天数'),
      }));
      const s = reversedReports.map((report) => ({
        year: report.year,
        type: '存货周转天数',
        value: getNumberInReport(report.data, 'leading-chzzts-存货周转天数'),
      }));
      return [...i, ...s].sort((a, b) => a.year - b.year);
    }, [reversedReports]);

    if (!reversedReports) {
      return (
        <div className="h-full flex flex-col rounded-lg border p-2">
          <div className="text-sm font-bold mb-2">回款能力</div>
          <Skeleton className="flex-1 w-full" />
        </div>
      );
    }

    return (
      <VChart
        spec={{
          type: 'line',
          title: { text: '回款能力', textStyle: { fontSize: 14, fontWeight: 'bold' } },
          data: { values },
          padding: [0],
          axes: [
            { orient: 'left', grid: { style: { strokeOpacity: 0.3 } } },
            { orient: 'bottom', trimPadding: true },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
          xField: 'year',
          yField: 'value',
          seriesField: 'type',
          point: { visible: false },
          tooltip: {
            visible: true,
            dimension: {
              title: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (datum: any) => datum?.year,
              },
              content: [
                {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  key: (datum: any) => datum?.type,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  value: (datum: any) => `${formatFinancialNumber(datum?.value)} 天`,
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              updateContent: (pre: any) =>
                pre
                  ?.slice()
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ?.sort((a: any, b: any) => Number(b?.datum?.value) - Number(a?.datum?.value)),
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
ReceivableCollectionCapacityLineChart.displayName = 'ReceivableCollectionCapacityLineChart';

export const ReceivableCollectionCapacityLineChartWithCard = memo(
  (props: ReceivableCollectionCapacityLineChartProps) => {
    return (
      <div className="rounded-lg border p-3 h-full w-full">
        <ReceivableCollectionCapacityLineChart {...props} />
      </div>
    );
  },
);
ReceivableCollectionCapacityLineChartWithCard.displayName =
  'ReceivableCollectionCapacityLineChartWithCard';
