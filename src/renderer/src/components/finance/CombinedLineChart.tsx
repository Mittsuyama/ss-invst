import { memo, useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { getNumberInReport, formatFinancialNumber } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface CombinedLineChartProps {
  reports?: FinancialReport[];
}

export const CombinedLineChart = memo(({ reports }: CombinedLineChartProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const values = useMemo(() => {
    if (!reversedReports) return [];
    const operationProfitValues = reversedReports.map((report) => ({
      date: report.year,
      type: '营业利润',
      value:
        getNumberInReport(report.data, 'l-yyzsr-营业总收入') -
        getNumberInReport(report.data, 'l-yyzcb-营业总成本'),
    }));
    const operationNetCashValues = reversedReports.map((report) => ({
      date: report.year,
      type: '经营净现金流',
      value: getNumberInReport(report.data, 'x-jyhdcsdxjllje-经营活动产生的现金流量净额'),
    }));
    const nonRecurringProfitLossMoveAverageValues = reversedReports.reduce<
      Array<{ date: number; type: string; value: number }>
    >((pre, report) => {
      const cur =
        getNumberInReport(report.data, 'x-jlr-净利润') -
        (getNumberInReport(report.data, 'l-yyzsr-营业总收入') -
          getNumberInReport(report.data, 'l-yyzcb-营业总成本'));
      pre.push({
        date: report.year,
        type: '非经常性损益移动平均',
        value: ((pre[pre.length - 1]?.value || 0) * 2) / 3 + (cur * 1) / 3,
      });
      return pre;
    }, []);
    const capitalMaintenanceCostMoveAverageValues = reversedReports.reduce<
      Array<{ date: number; type: string; value: number }>
    >((pre, report) => {
      const cur = getNumberInReport(
        report.data,
        'x-gjgdzcwxzchqtcqzczfdxj-购建固定资产、无形资产和其他长期资产支付的现金',
      );
      pre.push({
        date: report.year,
        type: '购建资产支出移动平均',
        value: ((pre[pre.length - 1]?.value || 0) * 2) / 3 + (cur * 1) / 3,
      });
      return pre;
    }, []);
    const estimatedReturn = operationProfitValues.map(({ date }, index) => {
      const avg =
        (operationProfitValues[index].value + operationNetCashValues[index].value || 0) / 2;
      return {
        date,
        type: '估计回报',
        value:
          avg +
          nonRecurringProfitLossMoveAverageValues[index].value -
          capitalMaintenanceCostMoveAverageValues[index].value,
      };
    });
    return [
      ...estimatedReturn,
      ...operationProfitValues,
      ...operationNetCashValues,
      ...nonRecurringProfitLossMoveAverageValues,
      ...capitalMaintenanceCostMoveAverageValues,
    ].sort((a, b) => a.date - b.date);
  }, [reversedReports]);

  if (!reversedReports) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">组合图表</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <VChart
      spec={{
        type: 'line',
        title: { text: '组合图表', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        padding: [0],
        data: { values },
        color: ['#FC3727AA', '#B8EECD77', '#FFCF7A77', '#94EFFF77', '#DDC5FA77'],
        axes: [
          {
            orient: 'left',
            grid: { style: { strokeOpacity: 0.3 } },
            label: { formatMethod: (val: string) => formatFinancialNumber(val) },
          },
          { orient: 'bottom', trimPadding: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        xField: 'date',
        yField: 'value',
        seriesField: 'type',
        point: { visible: false },
        tooltip: {
          visible: true,
          dimension: {
            title: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              value: (datum: any) => datum?.date,
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
CombinedLineChart.displayName = 'CombinedLineChart';

export const CombinedLineChartWithCard = memo((props: CombinedLineChartProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <CombinedLineChart {...props} />
    </div>
  );
});
CombinedLineChartWithCard.displayName = 'CombinedLineChartWithCard';
