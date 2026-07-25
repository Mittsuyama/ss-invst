import dayjs from 'dayjs';
import { request } from '@/lib/request';
import { RequestType } from '@shared/types/request';
import type { StockInfo } from '@shared/types/stock';
import { ACCOUNT_ITEM } from '@/lib/account-items';
import { computeSimpleCFC, standardDeviation } from '@/lib/finance';
import type {
  FinancialReport,
  ReportMonth,
  BizItem,
  StockWithReportsDetail,
} from '@/types/finance';
import type {
  DividendItem,
  ManagerItem,
  ManagerHoldingChangeItem,
  ReportOriginItem,
  ResearchReportItem,
  AttaceInfo,
  BizItemData,
} from '@/types/stock-extra';

// ============================================================
// 工具函数
// ============================================================

const makeSureArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  return [];
};

/**
 * 将 ss-invst 的 stockId（格式: "0.002460"，即 市场号.代码，0=深交所 1=上交所）
 * 转换为东财 SECUCODE 格式（"002460.SZ" / "600519.SH"）
 */
const stockIdToSecuCode = (stockId: string): string => {
  const [marketNum, code] = stockId.split('.');
  // 按代码前缀推断交易所
  if (code.startsWith('60') || code.startsWith('68')) return `${code}.SH`;
  if (code.startsWith('00') || code.startsWith('30')) return `${code}.SZ`;
  return `${code}.${marketNum === '1' ? 'SH' : 'SZ'}`;
};

/**
 * 将 ss-invst 的 stockId 转换为东财 NewFinanceAnalysis 的 code 格式（"SZ002460" / "SH600519"）
 */
const stockIdToEMCode = (stockId: string): string => {
  const [marketNum, code] = stockId.split('.');
  if (code.startsWith('60') || code.startsWith('68')) return `SH${code}`;
  if (code.startsWith('00') || code.startsWith('30')) return `SZ${code}`;
  return `${marketNum === '1' ? 'SH' : 'SZ'}${code}`;
};

/** 将 API 原始数据转为 FinancialReport */
const genFinancialReport = (item: unknown): FinancialReport => {
  const record = item as Record<string, unknown>;
  const date = record['REPORT_DATE'] as string;
  const [year, monthStr] = date.toString().split('-');
  let month: ReportMonth = 12;
  if (monthStr === '06') month = 6;
  else if (monthStr === '09') month = 9;
  else if (monthStr === '03') month = 3;
  return {
    month,
    year: Number(year),
    data: record as Record<string, string | number | undefined>,
  };
};

// ============================================================
// 领先指标 API
// ============================================================

const LEADING_INDEX_URL = 'https://datacenter.eastmoney.com/securities/api/data/get';

export const fetchLeadingIndex = async (stockId: string): Promise<FinancialReport[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const filter = `(SECUCODE="${secuCode}")`;

  const res = await request(RequestType.GET, LEADING_INDEX_URL, {
    type: 'RPT_F10_FINANCE_MAINFINADATA',
    sty: 'APP_F10_MAINFINADATA',
    quoteColumns: '',
    filter,
    p: '1',
    ps: '99',
    sr: '-1',
    st: 'REPORT_DATE',
    source: 'HSF10',
    client: 'PC',
  });

  return makeSureArray(res?.result?.data).map(genFinancialReport);
};

// ============================================================
// 三大报表 API（资产负债表、利润表、现金流量表）
// ============================================================

const CURRENT_YEAR = new Date().getFullYear();
const DATES_EX_YEAR: Array<{ month: ReportMonth; str: string }> = [
  { month: 12, str: '-12-31' },
  { month: 9, str: '-09-30' },
  { month: 6, str: '-06-30' },
  { month: 3, str: '-03-31' },
];

const REPORT_BASE_URL = 'https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis';

/**
 * 获取完整的财务报表（领先指标 + 资产负债表 + 利润表 + 现金流量表）
 * 自动尝试不同的 companyType（4→3→2→1）
 */
const fetchReportBundleWithFallback = async (
  stockId: string,
  path: string,
  years: number,
  months: ReportMonth[],
): Promise<FinancialReport[]> => {
  const reportHeaders = {
    Referer: 'https://emweb.securities.eastmoney.com/',
  };

  for (let j = 4; j > 0; j--) {
    const usableCode = stockIdToEMCode(stockId);
    const requestYears = Array.from({ length: years }, (_, index) => CURRENT_YEAR - index);
    const dates = requestYears.flatMap((year) =>
      DATES_EX_YEAR.filter((date) => months.includes(date.month)).map(
        (date) => `${year}${date.str}`,
      ),
    );

    const body = {
      companyType: String(j),
      reportDateType: '0',
      reportType: '1',
      code: usableCode,
    };

    const batch = 5;
    const batchCount = Math.ceil(dates.length / batch);
    const batchPromises = Array.from({ length: batchCount }).map(async (_, index) => {
      const res = await request(
        RequestType.GET,
        `${REPORT_BASE_URL}${path}`,
        {
          ...body,
          dates: dates.slice(index * batch, Math.min((index + 1) * batch, dates.length)).join(','),
        },
        reportHeaders,
      );
      try {
        return (res as { data?: unknown[] })?.data;
      } catch {
        return undefined;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const resList = batchResults.reduce<unknown[]>((pre, cur) => {
      if (Array.isArray(cur)) return pre.concat(cur);
      return pre;
    }, []);

    const data = makeSureArray(resList)
      .filter(Boolean)
      .map<FinancialReport>(genFinancialReport)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    if (data.length) return data;
  }
  return [];
};

/**
 * 获取合并后的财务报表（领先指标 + 三大报表合并）
 * 并行请求所有报表
 */
export const fetchFinancialReports = async (
  stockId: string,
  years: number,
  months: ReportMonth[] = [3, 6, 9, 12],
): Promise<FinancialReport[]> => {
  const [leadingList, zcfz, lr, xjll] = await Promise.all([
    fetchLeadingIndex(stockId),
    fetchReportBundleWithFallback(stockId, '/zcfzbAjaxNew', years, months),
    fetchReportBundleWithFallback(stockId, '/lrbAjaxNew', years, months),
    fetchReportBundleWithFallback(stockId, '/xjllbAjaxNew', years, months),
  ]);

  return zcfz.map<FinancialReport>((report, index) => {
    const leading = leadingList.find(
      (item) => item.year === report.year && item.month === report.month,
    );
    return {
      year: report.year,
      month: report.month,
      data: {
        ...report.data,
        ...leading?.data,
        ...lr[index]?.data,
        ...xjll[index]?.data,
      },
    };
  });
};

// ============================================================
// 主营业务 API
// ============================================================

const BUSINESS_URL = 'https://datacenter.eastmoney.com/securities/api/data/v1/get';

export const fetchBusiness = async (stockId: string) => {
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_F10_FN_MAINOP',
    columns:
      'SECUCODE,SECURITY_CODE,REPORT_DATE,MAINOP_TYPE,ITEM_NAME,MAIN_BUSINESS_INCOME,MBI_RATIO,MAIN_BUSINESS_COST,MBC_RATIO,MAIN_BUSINESS_RPOFIT,MBR_RATIO,GROSS_RPOFIT_RATIO,RANK',
    filter: `(SECUCODE="${stockIdToSecuCode(stockId)}")`,
    pageNumber: '1',
    pageSize: '200',
    sortTypes: '-1,1,1',
    sortColumns: 'REPORT_DATE,MAINOP_TYPE,RANK',
    source: 'HSF10',
    client: 'PC',
  });

  if (res?.code !== 0) {
    return { bizListByDistrict: [], bizListByProduct: [] };
  }

  const list = makeSureArray(res?.result?.data) as BizItem[];

  const lastAnualDate = list.reduce(
    (pre, cur) => {
      const [year, month, day] = cur.REPORT_DATE.split(' ')[0].split('-');
      if (month === '12' && Number(year) > pre.year) {
        return { year: Number(year), date: `${year}-${month}-${day}` };
      }
      return pre;
    },
    { year: 0, date: '' },
  );

  const bizList = list.filter((item) => item.REPORT_DATE.startsWith(lastAnualDate.date));

  return {
    bizListByProduct: bizList
      .filter((item) => item.MAINOP_TYPE === '2')
      .sort((a, b) => b.MAIN_BUSINESS_INCOME - a.MAIN_BUSINESS_INCOME),
    bizListByDistrict: bizList
      .filter((item) => item.MAINOP_TYPE === '3')
      .sort((a, b) => b.MAIN_BUSINESS_INCOME - a.MAIN_BUSINESS_INCOME),
  };
};

// ============================================================
// 组合：StockWithReportsDetail
// ============================================================

/** 将 StockInfo + reports 转为 StockWithReportsDetail */
export const transformToStockWithReportsDetail = (
  stock: StockInfo,
  reports: FinancialReport[],
  month: ReportMonth,
): StockWithReportsDetail => {
  const yearReports = reports.filter((item) => item.month === month);
  return {
    ...stock,
    fcfAvg3: (computeSimpleCFC(yearReports, 3) / stock.cap) * 100,
    fcf: (computeSimpleCFC(yearReports, 1) / stock.cap) * 100,
    lastYearRoe: Number(yearReports[0]?.data[ACCOUNT_ITEM['leading-kfjqroe-扣非加权ROE']]) || 0,
    gprStd: standardDeviation(
      yearReports.map(
        (report) => Number(report.data[ACCOUNT_ITEM['leading-xsmll-销售毛利率']]) * 100,
      ),
    ),
    roeStd: standardDeviation(
      yearReports.map(
        (report) => Number(report.data[ACCOUNT_ITEM['leading-kfjqroe-扣非加权ROE']]) * 100,
      ),
    ),
    reports,
  };
};

// ============================================================
// 分红历史 API
// ============================================================

export const fetchDividendHistory = async (stockId: string): Promise<DividendItem[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_F10_DIVIDEND_CURVE',
    columns: 'ALL',
    filter: `(SECUCODE="${secuCode}")(TRADE_DATE>='${dayjs().add(-3, 'year').format('YYYY-MM-DD')}')`,
    pageNumber: 1,
    sortTypes: 1,
    sortColumns: 'TRADE_DATE',
    source: 'HSF10',
    client: 'PC',
  });
  return makeSureArray<Record<string, unknown>>(res?.result?.data).map((item) => ({
    ...item,
    TRADE_DATE: dayjs(item.TRADE_DATE as string).format('YYYY-MM-DD'),
  })) as DividendItem[];
};

// ============================================================
// 高管信息 API
// ============================================================

export const fetchManagers = async (stockId: string): Promise<ManagerItem[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_F10_ORGINFO_MANAINTRO',
    columns: 'ALL',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: 1,
    source: 'HSF10',
    client: 'PC',
  });
  return makeSureArray(res?.result?.data);
};

// ============================================================
// 高管持股变动 API
// ============================================================

export const fetchManagerHoldingChange = async (
  stockId: string,
): Promise<ManagerHoldingChangeItem[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_F10_TRADE_EXCHANGEHOLD',
    columns:
      'SECUCODE,SECURITY_CODE,SECURITY_INNER_CODE,SECURITY_NAME_ABBR,SECURITY_PINYIN,ORG_CODE,END_DATE,HOLDER_NAME,CHANGE_NUM,AVERAGE_PRICE,CHANGE_AFTER_HOLDNUM,TRADE_WAY,EXECUTIVE_NAME,POSITION,EXECUTIVE_RELATION',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: 1,
    pageSize: 100,
    sortTypes: -1,
    sortColumns: 'END_DATE',
    source: 'HSF10',
    client: 'PC',
  });
  return makeSureArray(res?.result?.data);
};

// ============================================================
// 原始财报信息 API
// ============================================================

export const fetchReportOriginInfo = async (stockId: string): Promise<ReportOriginItem[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_PCF10_ORIG_REPORT',
    columns: 'YEAR,SECUCODE,SECURITY_CODE,REPORT_DATE,REPORT_TYPE,PUBLISH_SITUATIONS,OPINION_TYPE',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: 1,
    sortTypes: -1,
    sortColumns: 'REPORT_DATE',
    source: 'HSF10',
    client: 'PC',
  });
  return makeSureArray(res?.result?.data);
};

// ============================================================
// 研究报告 API
// ============================================================

const REPORT_LIST_URL = 'https://np-areport-pc.eastmoney.com/api/security/rep';

export const fetchResearchReportList = async (stockId: string): Promise<ResearchReportItem[]> => {
  const [marketNum, code] = stockId.split('.');
  const res = await request(RequestType.GET, REPORT_LIST_URL, {
    client_source: 'web',
    business: 'f10',
    page_index: 1,
    page_size: 999,
    begin_time: dayjs().add(-3, 'year').format('YYYY-MM-DD'),
    end_time: dayjs().format('YYYY-MM-DD'),
    stock_list: `${marketNum === '1' ? '1' : '0'}.${code}`,
    type: 'A',
    report_type: '0,1',
  });
  return makeSureArray(res?.data?.list);
};

export const fetchBusinessResearchReportList = async (
  bizId: string,
): Promise<ResearchReportItem[]> => {
  const res = await request(RequestType.GET, REPORT_LIST_URL, {
    client_source: 'web',
    business: 'f10',
    page_index: 1,
    page_size: 999,
    begin_time: dayjs().add(-1, 'year').format('YYYY-MM-DD'),
    end_time: dayjs().format('YYYY-MM-DD'),
    indu_old_industry_code: Number(bizId.replace('BK', '')),
    report_type: '2',
  });
  return makeSureArray(res?.data?.list);
};

export const fetchResearchReportPdf = async (artCode: string): Promise<AttaceInfo> => {
  const res = await request(
    RequestType.GET,
    'https://np-creport-pc.eastmoney.com/api/content/rep',
    {
      art_code: artCode,
      client_source: 'web',
      page_index: '1',
    },
  );
  return {
    attach_url: res?.data?.attach_url ?? '',
    attach_pages: res?.data?.attach_pages ?? 0,
  };
};

export const fetchPdfUrl = async (publishSituation: string): Promise<string> => {
  const res = await request(
    RequestType.GET,
    'https://np-cnotice-stock.eastmoney.com/api/content/ann',
    {
      art_code: publishSituation,
      client_source: 'web',
      page_index: '1',
    },
  );
  return res?.data?.attach_url ?? '';
};

// ============================================================
// 业务数据（BizItemData）API
// ============================================================

export const fetchBizItems = async (
  stockId: string,
  month: ReportMonth,
): Promise<BizItemData[]> => {
  const secuCode = stockIdToSecuCode(stockId);
  const res = await request(RequestType.GET, BUSINESS_URL, {
    reportName: 'RPT_F10_FN_MAINOP',
    columns:
      'SECUCODE,SECURITY_CODE,REPORT_DATE,MAINOP_TYPE,ITEM_NAME,MAIN_BUSINESS_INCOME,MBI_RATIO,MAIN_BUSINESS_COST,MBC_RATIO,MAIN_BUSINESS_RPOFIT,MBR_RATIO,GROSS_RPOFIT_RATIO,RANK',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: '1',
    pageSize: '200',
    sortTypes: '-1,1,1',
    sortColumns: 'REPORT_DATE,MAINOP_TYPE,RANK',
    source: 'HSF10',
    client: 'PC',
  });

  if (res?.code !== 0) return [];

  const list = makeSureArray(res?.result?.data) as BizItem[];
  const bizList: BizItemData[] = [];
  list.forEach((item) => {
    if (item.MAINOP_TYPE !== '2') return;
    const [year, monthStr] = item.REPORT_DATE.split(' ')[0].split('-');
    const itemMonth = Number(monthStr) as ReportMonth;
    if (itemMonth === month) {
      bizList.push({
        year: Number(year),
        month: itemMonth,
        name: item.ITEM_NAME,
        income: item.MAIN_BUSINESS_INCOME,
        ratio: item.MBI_RATIO,
        gpr: item.GROSS_RPOFIT_RATIO,
      });
    }
  });
  return bizList;
};
