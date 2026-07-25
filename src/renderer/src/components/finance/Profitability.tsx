import { memo, useMemo } from 'react';
import { BarChart } from '@visactor/react-vchart';
import { getNumberInReport } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfitabilityProps {
  reports?: FinancialReport[];
  cap?: number;
}

export const Profitability = memo(({ reports, cap }: ProfitabilityProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const values = useMemo(() => {
    if (!reversedReports || !cap) return [];

    const mll = reversedReports.map((item) => ({
      year: item.year,
      type: '毛利率',
      value: getNumberInReport(item.data, 'leading-xsmll-销售毛利率'),
    }));
    const yylrl = reversedReports.map((item) => ({
      year: item.year,
      type: '营业利润率',
      value:
        ((getNumberInReport(item.data, 'l-yysr-营业收入') -
          getNumberInReport(item.data, 'l-yycb-营业成本') -
          getNumberInReport(item.data, 'l-xsfy-销售费用') -
          getNumberInReport(item.data, 'l-glfy-管理费用') -
          getNumberInReport(item.data, 'l-yffy-研发费用') -
          Math.max(0, getNumberInReport(item.data, 'l-lxfy-利息费用'))) /
          getNumberInReport(item.data, 'l-yysr-营业收入')) *
        100,
    }));
    const jlr = reversedReports.map((item) => ({
      year: item.year,
      type: '净利率',
      value: getNumberInReport(item.data, 'leading-xsjll-销售净利率'),
    }));
    const roe = reversedReports.map((item) => ({
      year: item.year,
      type: '加权扣非 ROE',
      value: getNumberInReport(item.data, 'leading-kfjqroe-扣非加权ROE'),
    }));

    return [...mll, ...yylrl, ...jlr, ...roe].sort((a, b) => a.year - b.year);
  }, [reversedReports, cap]);

  if (!reversedReports || !cap) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">盈利能力</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <BarChart
      key={
        reversedReports[0] ? getNumberInReport(reversedReports[0].data, 'z-zczj-资产总计') : 'empty'
      }
      spec={{
        type: 'bar' as const,
        title: { text: '盈利能力', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        data: { values },
        xField: ['year', 'type'],
        yField: 'value',
        seriesField: 'type',
        padding: [0],
        axes: [
          {
            orient: 'left',
            softMax: 100,
            softMin: 0,
            grid: { style: { strokeOpacity: 0.3 } },
            label: { formatMethod: (val: string) => `${(Number(val) || 0).toFixed(0)}%` },
          },
          { orient: 'bottom', trimPadding: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        tooltip: {
          confine: false,
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
                value: (datum: any) => `${(Number(datum?.value) || 0).toFixed(2)}%`,
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
  );
});
Profitability.displayName = 'Profitability';

export const ProfitabilityWithCard = memo((props: ProfitabilityProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <Profitability {...props} />
    </div>
  );
});
ProfitabilityWithCard.displayName = 'ProfitabilityWithCard';
