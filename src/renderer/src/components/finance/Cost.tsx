import { memo, useMemo } from 'react';
import { AreaChart } from '@visactor/react-vchart';
import { ACCOUNT_ITEM } from '@/lib/account-items';
import { getNumberInReport } from '@/lib/finance';
import type { FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface CostProps {
  reports?: FinancialReport[];
}

const keyList: Array<keyof typeof ACCOUNT_ITEM> = [
  'l-xsfy-销售费用',
  'l-glfy-管理费用',
  'l-yffy-研发费用',
  'l-lxfy-利息费用',
];

const getIndex = (key: string) => {
  if (key === 'rest') return -1;
  if (key === 'other') return keyList.length;
  return keyList.findIndex((item) => item === key);
};

export const Cost = memo(({ reports }: CostProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const valuesWithoutRest = useMemo(() => {
    if (!reversedReports) return [];
    return reversedReports.flatMap((report) =>
      keyList.map((item) => {
        const value = Number(report.data[ACCOUNT_ITEM[item]]) || 0;
        return {
          key: item,
          year: report.year,
          name: item.split('-').slice(-1)[0],
          value,
        };
      }),
    );
  }, [reversedReports]);

  const totalMap = useMemo(() => {
    if (!reversedReports) return {};
    return Object.fromEntries(
      reversedReports.map((report) => [
        report.year,
        getNumberInReport(report.data, 'l-yysr-营业收入') -
          getNumberInReport(report.data, 'l-yycb-营业成本'),
      ]),
    ) as Record<number, number>;
  }, [reversedReports]);

  const rest = useMemo(() => {
    if (!reversedReports) return [];
    return reversedReports.map((report) => {
      const { year } = report;
      const total =
        getNumberInReport(report.data, 'l-yysr-营业收入') -
        getNumberInReport(report.data, 'l-yycb-营业成本');
      const valuesInYear = valuesWithoutRest
        .filter((item) => item.year === year)
        .map((item) => item.value);
      const sum = valuesInYear.reduce((a, b) => a + b, 0);
      const value = total - sum;
      return { key: 'rest', year, name: '营业利润剩余', value };
    });
  }, [reversedReports, valuesWithoutRest]);

  const others = useMemo(() => {
    if (!reversedReports) return [];
    return reversedReports.map((report) => {
      const { year } = report;
      const netProfit = getNumberInReport(report.data, 'x-jlr-净利润');
      const restInYear = rest.find((item) => item.year === year)?.value || 0;
      return { key: 'other', year, name: '其他损益', value: restInYear - netProfit };
    });
  }, [reversedReports, rest]);

  const values = useMemo(() => {
    const res = [...rest, ...valuesWithoutRest, ...others];
    return res.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return getIndex(b.key) - getIndex(a.key);
    });
  }, [valuesWithoutRest, rest, others]);

  if (!reversedReports) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">费用占比</div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <AreaChart
      key={
        reversedReports[0] ? getNumberInReport(reversedReports[0].data, 'z-zczj-资产总计') : 'empty'
      }
      spec={{
        type: 'area',
        title: { text: '费用占比', textStyle: { fontSize: 14, fontWeight: 'bold' } },
        data: { values },
        stack: true,
        xField: 'year',
        yField: 'value',
        seriesField: 'name',
        point: { visible: false },
        padding: [0],
        axes: [
          {
            orient: 'left',
            grid: { style: { strokeOpacity: 0.3 } },
            label: { formatMethod: (val: string) => `${(Number(val) || 0) / 100_000_000} 亿` },
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
                key: (datum: any) => datum?.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value: (datum: any) =>
                  `${datum?.value ? `${(datum.value / 100_000_000).toFixed(2)} 亿` : '--'}（${
                    totalMap[datum?.year] && datum?.value
                      ? `${((datum.value / totalMap[datum.year]) * 100).toFixed(2)}%`
                      : '--'
                  }）`,
              },
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateContent: (pre: any) => pre?.slice()?.reverse(),
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
Cost.displayName = 'Cost';

export const CostWithCard = memo((props: CostProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <Cost {...props} />
    </div>
  );
});
CostWithCard.displayName = 'CostWithCard';
