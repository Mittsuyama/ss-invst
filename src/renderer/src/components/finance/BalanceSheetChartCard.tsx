import { memo, useMemo } from 'react';
import { AreaChart } from '@visactor/react-vchart';
import { ACCOUNT_ITEM, sheetType2Title, totalKeyRecord, sheetType2Keys } from '@/lib/account-items';
import { getNumberInReport } from '@/lib/finance';
import type { BalanceSheetType, FinancialReport } from '@/types/finance';
import { Skeleton } from '@/components/ui/skeleton';

interface BalanceSheetChartCardProps {
  type: BalanceSheetType;
  reports?: FinancialReport[];
}

export const BalanceSheetChartCard = memo(({ type, reports }: BalanceSheetChartCardProps) => {
  const reversedReports = useMemo(() => reports?.slice().reverse(), [reports]);

  const valuesWithoutRest = useMemo(() => {
    if (!reversedReports) return [];
    const data = reversedReports.flatMap((report) =>
      sheetType2Keys[type].map((item) => {
        const value = Number(report.data[ACCOUNT_ITEM[item]]) || 0;
        return {
          year: report.year,
          name: item.split('-').slice(-1)[0],
          value,
        };
      }),
    );
    const noneZeroNameSet = new Set(data.filter((item) => !!item.value).map((item) => item.name));
    const latestYearValues = data.filter((item) => item.year === reversedReports[0].year);
    return data
      .filter((item) => noneZeroNameSet.has(item.name))
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        const aValue = latestYearValues.find((item) => item.name === a.name)?.value || 0;
        const bValue = latestYearValues.find((item) => item.name === b.name)?.value || 0;
        return aValue - bValue;
      });
  }, [reversedReports, type]);

  const totalMap = useMemo(() => {
    if (!reversedReports) return {};
    return Object.fromEntries(
      reversedReports.map((report) => [
        report.year,
        report.data[ACCOUNT_ITEM[totalKeyRecord[type]]],
      ]),
    ) as Record<number, number>;
  }, [reversedReports, type]);

  const rest = useMemo(() => {
    if (!reversedReports) return [];
    return reversedReports.map(({ year, data }) => {
      const total = Number(data[ACCOUNT_ITEM[totalKeyRecord[type]]]) || 0;
      const valuesInYear = valuesWithoutRest
        .filter((item) => item.year === year)
        .map((item) => item.value);
      const sum = valuesInYear.reduce((a, b) => a + b, 0);
      const value = total - sum;
      return {
        year,
        name: '剩余',
        value: Math.abs(value) < 1_000 ? 0 : value,
      };
    });
  }, [reversedReports, valuesWithoutRest, type]);

  const values = useMemo(() => {
    const res = [...rest, ...valuesWithoutRest];
    if (!reversedReports?.length) return res;
    const latestYearValues = res.filter((item) => item.year === reversedReports[0].year);
    return res.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const aValue = latestYearValues.find((item) => item.name === a.name)?.value || 0;
      const bValue = latestYearValues.find((item) => item.name === b.name)?.value || 0;
      return aValue - bValue;
    });
  }, [valuesWithoutRest, rest, reversedReports]);

  if (!reversedReports) {
    return (
      <div className="h-full flex flex-col rounded-lg border p-2">
        <div className="text-sm font-bold mb-2">{sheetType2Title[type]}</div>
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
        title: { text: sheetType2Title[type], textStyle: { fontSize: 14, fontWeight: 'bold' } },
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
BalanceSheetChartCard.displayName = 'BalanceSheetChartCard';

export const BalanceSheetChartCardWithCard = memo((props: BalanceSheetChartCardProps) => {
  return (
    <div className="rounded-lg border p-3 h-full w-full">
      <BalanceSheetChartCard {...props} />
    </div>
  );
});
BalanceSheetChartCardWithCard.displayName = 'BalanceSheetChartCardWithCard';
