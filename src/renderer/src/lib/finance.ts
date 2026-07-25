import { ACCOUNT_ITEM } from './account-items';
import type { FinancialReport } from '@/types/finance';

// ============================================================
// 数学工具
// ============================================================

export const deviation = (arr: number[]) => {
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.map((item) => (item - avg) * (item - avg)).reduce((a, b) => a + b, 0) / arr.length;
};

export const standardDeviation = (arr: number[]) => Math.sqrt(deviation(arr));

export const avg = (nums: number[]) =>
  nums.reduce((pre, cur) => pre + (Number(cur) || 0), 0) / nums.length;

// ============================================================
// 格式化
// ============================================================

export interface FormatFinancialNumberOptions {
  unit?: '%' | 'none';
  replaceNaNWithZero?: boolean;
}

export const formatFinancialNumber = (
  data: unknown,
  options: FormatFinancialNumberOptions = {},
): string => {
  let num = NaN;
  if (typeof data === 'string') {
    num = Number(data);
  } else if (typeof data === 'number') {
    num = data;
  } else {
    num = NaN;
  }
  if (Number.isNaN(num)) {
    if (options.replaceNaNWithZero) {
      return '0';
    }
    return 'NaN';
  }
  if (Math.abs(num) > 1_0000_0000) {
    return `${(num / 1_0000_0000).toFixed(2)} 亿`;
  }
  if (Math.abs(num) > 1_0000) {
    return `${(num / 1_0000).toFixed(2)} 万`;
  }
  return `${num.toFixed(2)}${options.unit === 'none' ? '' : options.unit || ''}`;
};

/** 从财报数据中提取数值 */
export const getNumberInReport = (
  report: FinancialReport['data'],
  key: keyof typeof ACCOUNT_ITEM,
) => {
  return Number(report[ACCOUNT_ITEM[key]]) || 0;
};

// ============================================================
// 自由现金流计算
// ============================================================

export const computeSimpleCFC = (reports: FinancialReport[], years = 1) => {
  const cfcs = reports.map((report) => {
    return (
      Number(report.data[ACCOUNT_ITEM['x-jyhdcsdxjllje-经营活动产生的现金流量净额']]) -
        Number(
          report.data[
            ACCOUNT_ITEM['x-gdzczjyqzczhscxswzczj-固定资产折旧、油气资产折耗、生产性生物资产折旧']
          ],
        ) -
        Number(report.data[ACCOUNT_ITEM['x-wxzctx-无形资产摊销']]) || 0
    );
  });
  return avg(cfcs.slice(0, years));
};

// ============================================================
// 图表数据生成
// ============================================================

export interface ChartDataItem {
  seriesName: string;
  percent: number;
  percentToBase: number;
  value: number;
  year: number;
  month: number;
}

interface GetValidItemsParams {
  report: FinancialReport;
  accountItemKeys: Array<keyof typeof ACCOUNT_ITEM>;
  total?: number;
  base?: number;
  minPercent?: number;
}

const getValidItems = ({
  report,
  total,
  base,
  accountItemKeys,
  minPercent,
}: GetValidItemsParams) => {
  const datas = accountItemKeys
    .map<ChartDataItem | undefined>((key) => {
      const value = Number(report.data[ACCOUNT_ITEM[key]]) || 0;
      const percent = (value / (total || 1)) * 100;
      const percentToBase = (value / (base || 1)) * 100;
      if (typeof minPercent === 'undefined' || percent > minPercent) {
        const [, , chinese] = key.split('-');
        return {
          seriesName: chinese,
          value,
          percent,
          percentToBase,
          year: report.year,
          month: report.month,
        };
      }
      return undefined;
    })
    .filter((item): item is ChartDataItem => !!item);

  const totalValue = datas.reduce((pre, cur) => pre + (cur?.value || 0), 0);

  const restItem: ChartDataItem[] =
    total && Math.abs(total - totalValue) > 1_0000
      ? [
          {
            year: report.year,
            month: report.month,
            seriesName: '剩余',
            value: total - totalValue,
            percent: ((total - totalValue) / total) * 100,
            percentToBase: ((total - totalValue) / (base || 1)) * 100,
          },
        ]
      : [];

  return datas
    .concat(restItem)
    .filter((data): data is ChartDataItem => Boolean(data))
    .sort((a, b) => a.value - b.value);
};

interface GetLineDataParams extends Pick<GetValidItemsParams, 'accountItemKeys' | 'minPercent'> {
  reports: FinancialReport[];
  totals?: number[];
  totalName?: string;
}

export const getLineData = ({
  reports,
  totals,
  accountItemKeys,
  minPercent,
  totalName,
}: GetLineDataParams) => {
  const itemsInEveryReports = reports.map((report, index) => {
    return getValidItems({
      report,
      base: totals?.[0],
      total: totals?.[index],
      accountItemKeys,
      minPercent,
    });
  });

  const seriesNameList = Array.from(
    new Set(itemsInEveryReports.flatMap((items) => items.map((item) => item.seriesName))),
  );

  const series = seriesNameList
    .map((name) => {
      return {
        name,
        datas: itemsInEveryReports.map<ChartDataItem>((items, index) => {
          const findedItem = items.find((item) => item.seriesName === name);
          return {
            seriesName: name,
            year: reports[index].year,
            month: reports[index].month,
            percentToBase: findedItem?.percentToBase || 0,
            percent: findedItem?.percent || 0,
            value: findedItem?.value || 0,
          };
        }),
      };
    })
    .concat(
      totals
        ? [
            {
              name: totalName || 'Total',
              datas: totals.map((total, index) => ({
                seriesName: totalName || 'Total',
                year: reports[index].year,
                month: reports[index].month,
                percent: 100,
                percentToBase: (total / totals[0]) * 100,
                value: total,
              })),
            },
          ]
        : [],
    )
    .sort((a, b) => {
      return (
        (b.datas[b.datas.length - 1].percent || 0) - (a.datas[a.datas.length - 1].percent || 0)
      );
    });

  return { series };
};
