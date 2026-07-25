import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { getNumberInReport, formatFinancialNumber } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface MarginCostCoverageLineChartProps {
  reports?: FinancialReport[];
}

export const MarginCostCoverageLineChart = memo(({ reports }: MarginCostCoverageLineChartProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const values = useMemo(() => {
    if (!reversedReports || reversedReports.length < 2) return [];
    const dev = reversedReports.slice(1).map((report, index) => ({
      year: report.year,
      type: '每单位毛利所需研发费用',
      value:
        (getNumberInReport(reversedReports[index + 1].data, 'l-yffy-研发费用') /
          (getNumberInReport(reversedReports[index].data, 'l-yyzsr-营业总收入') -
            getNumberInReport(reversedReports[index].data, 'l-yyzcb-营业总成本'))) *
        100,
    }));
    const market = reversedReports.slice(1).map((report, index) => ({
      year: report.year,
      type: '每单位毛利所需销售费用',
      value:
        (getNumberInReport(reversedReports[index + 1].data, 'l-xsfy-销售费用') /
          (getNumberInReport(reversedReports[index].data, 'l-yyzsr-营业总收入') -
            getNumberInReport(reversedReports[index].data, 'l-yyzcb-营业总成本'))) *
        100,
    }));
    const capex = reversedReports.slice(1).map((report, index) => ({
      year: report.year,
      type: '每单位毛利所需资本支出',
      value:
        (getNumberInReport(
          reversedReports[index + 1].data,
          'x-gjgdzcwxzchqtcqzczfdxj-购建固定资产、无形资产和其他长期资产支付的现金',
        ) /
          (getNumberInReport(reversedReports[index].data, 'l-yyzsr-营业总收入') -
            getNumberInReport(reversedReports[index].data, 'l-yyzcb-营业总成本'))) *
        100,
    }));
    return [...dev, ...market, ...capex].sort((a, b) => a.year - b.year);
  }, [reversedReports]);

  if (!reversedReports) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">每单位毛利所需费用</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <VChart
      spec={{
        type: 'line',
        title: { text: '每单位毛利所需费用', textStyle: { fontSize: 14, fontWeight: 'bold' } },
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
            label: { formatMethod: (val: string) => formatFinancialNumber(val, { unit: '%' }) },
          },
          { orient: 'bottom', trimPadding: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
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
                value: (datum: any) => formatFinancialNumber(datum?.value, { unit: '%' }),
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
});
MarginCostCoverageLineChart.displayName = 'MarginCostCoverageLineChart';

export const MarginCostCoverageLineChartWithCard = memo(
  (props: MarginCostCoverageLineChartProps) => {
    return (
      <div className="rounded-lg border p-3 h-full w-full">
        <MarginCostCoverageLineChart {...props} />
      </div>
    );
  },
);
MarginCostCoverageLineChartWithCard.displayName = 'MarginCostCoverageLineChartWithCard';
