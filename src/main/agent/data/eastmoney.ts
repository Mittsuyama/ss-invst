import { axiosGet } from '../../utils/axios';
import { FIELD_LABELS } from './field-labels';

/** Agent 运行时上下文（每次提问时由渲染进程注入） */
export const runtime = {
  cookie: '',
  tushareToken: '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emGet(
  url: string,
  params: Record<string, unknown>,
  headers: Record<string, unknown> = {},
): Promise<any> {
  const res = await axiosGet(url, params, { cookie: runtime.cookie, ...headers });
  if (res.code !== 0) {
    throw new Error(res.message || `东方财富接口请求失败: ${url}`);
  }
  return res.data;
}

const makeArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/** 股票 id（市场号.代码，如 0.600519）→ 东财 SECUCODE（600519.SH） */
const stockIdToSecuCode = (stockId: string): string => {
  const code = stockId.split('.')[1] ?? stockId;
  if (code.startsWith('60') || code.startsWith('68')) return `${code}.SH`;
  if (
    code.startsWith('00') ||
    code.startsWith('30') ||
    code.startsWith('8') ||
    code.startsWith('4')
  )
    return `${code}.SZ`;
  return `${code}.${stockId.startsWith('1.') ? 'SH' : 'SZ'}`;
};

/** secid（1.600519）→ tushare ts_code（600519.SH），与东财 SECUCODE 同格式 */
export const secidToTsCode = stockIdToSecuCode;

/** 股票 id → 东财 NewFinanceAnalysis code（SH600519 / SZ000001） */
const stockIdToEMCode = (stockId: string): string => {
  const code = stockId.split('.')[1] ?? stockId;
  if (code.startsWith('60') || code.startsWith('68')) return `SH${code}`;
  return `SZ${code}`;
};

export interface SearchResult {
  id: string;
  code: string;
  market: string;
  name: string;
  exchange: string;
}

/** 按名称/代码/拼音搜索证券 */
export async function searchSecurities(keyword: string): Promise<SearchResult[]> {
  const data = await emGet('https://search-codetable.eastmoney.com/codetable/search/web', {
    client: 'web',
    keyword,
    pageIndex: 1,
    pageSize: 30,
  });
  if (data?.code !== '0') {
    throw new Error(data?.msg || '搜索失败');
  }
  return makeArray<Record<string, string>>(data?.result).map((item) => ({
    id: `${item.market}.${item.code}`,
    code: item.code,
    market: item.market,
    name: item.shortName,
    exchange: item.securityTypeName,
  }));
}

export interface QuoteInfo {
  id: string;
  code: string;
  name: string;
  price: number;
  changeRate: number;
  peTtm: number;
  pb: number;
  marketCap: number;
  turnoverRate: number;
  high: number;
  low: number;
  open: number;
  preClose: number;
  amount: number;
  listDate: string;
  industry: string;
}

/** 获取个股行情快照（实时） */
export async function getQuote(secid: string): Promise<QuoteInfo> {
  const fields =
    'f43,f57,f58,f60,f107,f116,f117,f162,f163,f164,f167,f168,f169,f170,f171,f189,f14,f191';
  const data = await emGet('https://push2.eastmoney.com/api/qt/stock/get', {
    fltt: 2,
    invt: 2,
    fields,
    secid,
  });
  const d = data?.data ?? {};
  const code = secid.split('.')[1] ?? secid;
  return {
    id: secid,
    code,
    name: d.f58 ?? '',
    price: Number(d.f43 ?? 0),
    changeRate: Number(d.f170 ?? 0),
    peTtm: Number(d.f164 ?? 0),
    pb: Number(d.f167 ?? 0),
    marketCap: Number(d.f116 ?? 0),
    turnoverRate: Number(d.f168 ?? 0),
    high: Number(d.f171 ?? 0),
    low: Number(d.f172 ?? 0),
    open: Number(d.f171 ?? 0),
    preClose: Number(d.f60 ?? 0),
    amount: Number(d.f173 ?? 0),
    listDate: d.f189 ?? '',
    industry: d.f191 ?? '',
  };
}

export interface KlineRow {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  amplitude: number;
  changeRate: number;
  change: number;
  turnoverRate: number;
}

/** 日K/周K/月K 数据（含技术指标列）。fqt：0=不复权，1=前复权（默认），2=后复权 */
export async function getKlines(
  secid: string,
  period: 'day' | 'week' | 'month' = 'day',
  limit = 120,
  fqt: '0' | '1' | '2' = '1',
): Promise<{ rows: KlineRow[]; summary: Record<string, unknown> }> {
  const klt = period === 'week' ? '102' : period === 'month' ? '103' : '101';
  const data = await emGet('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt,
    fqt,
    end: '20500101',
    lmt: String(limit),
  });
  const klines = makeArray<string>(data?.data?.klines);
  const rows: KlineRow[] = klines.map((line) => {
    const [
      date,
      open,
      close,
      high,
      low,
      volume,
      amount,
      amplitude,
      changeRate,
      change,
      turnoverRate,
    ] = line.split(',');
    return {
      date,
      open: Number(open),
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
      amount: Number(amount),
      amplitude: Number(amplitude),
      changeRate: Number(changeRate),
      change: Number(change),
      turnoverRate: Number(turnoverRate),
    };
  });
  return {
    rows,
    summary: { name: data?.data?.name ?? '', code: data?.data?.code ?? '', count: rows.length },
  };
}

export interface FinancialReportRecord {
  report_date: string;
  year: number;
  month: number;
  [label: string]: string | number | null;
}

const REPORT_BASE_URL = 'https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis';
const CURRENT_YEAR = new Date().getFullYear();
const DATES_EX_YEAR = ['-12-31', '-09-30', '-06-30', '-03-31'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function labelRecord(raw: Record<string, any>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const v = raw[field];
    if (v === null || v === undefined || v === '') continue;
    out[label] = typeof v === 'number' ? v : v;
  }
  return out;
}

async function fetchReportBundle(
  emCode: string,
  path: string,
  years: number,
): Promise<Record<string, unknown>[]> {
  for (let companyType = 4; companyType > 0; companyType--) {
    const dates = Array.from({ length: years }, (_, i) => CURRENT_YEAR - i).flatMap((y) =>
      DATES_EX_YEAR.map((d) => `${y}${d}`),
    );
    const body = {
      companyType: String(companyType),
      reportDateType: '0',
      reportType: '1',
      code: emCode,
    };
    const batch = 5;
    const batchCount = Math.ceil(dates.length / batch);
    const results = await Promise.all(
      Array.from({ length: batchCount }, (_, i) =>
        emGet(`${REPORT_BASE_URL}${path}`, {
          ...body,
          dates: dates.slice(i * batch, Math.min((i + 1) * batch, dates.length)).join(','),
        }).catch(() => undefined),
      ),
    );
    const list = results.flatMap((r) => makeArray<Record<string, unknown>>(r?.data));
    if (list.length) return list;
  }
  return [];
}

/** 获取财务报表（三大报表 + 领先指标），近 years 年，字段已映射为中文 */
export async function getFinancialStatements(
  secid: string,
  years = 5,
): Promise<FinancialReportRecord[]> {
  const emCode = stockIdToEMCode(secid);
  const secuCode = stockIdToSecuCode(secid);

  const [zcfz, lr, xjll, leadingRaw] = await Promise.all([
    fetchReportBundle(emCode, '/zcfzbAjaxNew', years),
    fetchReportBundle(emCode, '/lrbAjaxNew', years),
    fetchReportBundle(emCode, '/xjllbAjaxNew', years),
    emGet('https://datacenter.eastmoney.com/securities/api/data/get', {
      type: 'RPT_F10_FINANCE_MAINFINADATA',
      sty: 'APP_F10_MAINFINADATA',
      quoteColumns: '',
      filter: `(SECUCODE="${secuCode}")`,
      p: '1',
      ps: '100',
      sr: '-1',
      st: 'REPORT_DATE',
      source: 'HSF10',
      client: 'PC',
    }).catch(() => undefined),
  ]);

  const leadingByDate = new Map<string, Record<string, unknown>>();
  for (const item of makeArray<Record<string, unknown>>(leadingRaw?.result?.data)) {
    const date = String(item.REPORT_DATE ?? '').split(' ')[0];
    leadingByDate.set(date, item);
  }

  // 以资产负债表为基准合并（三大报表按 REPORT_DATE 对齐）
  const merged: FinancialReportRecord[] = [];
  const lrByDate = new Map<string, Record<string, unknown>>();
  const xjllByDate = new Map<string, Record<string, unknown>>();
  for (const item of lr) lrByDate.set(String(item.REPORT_DATE ?? '').split(' ')[0], item);
  for (const item of xjll) xjllByDate.set(String(item.REPORT_DATE ?? '').split(' ')[0], item);

  for (const z of zcfz) {
    const date = String(z.REPORT_DATE ?? '').split(' ')[0];
    const raw = {
      ...z,
      ...(lrByDate.get(date) ?? {}),
      ...(xjllByDate.get(date) ?? {}),
      ...(leadingByDate.get(date) ?? {}),
    };
    const [year, monthStr] = date.split('-');
    merged.push({
      report_date: date,
      year: Number(year),
      month: monthStr === '12' ? 12 : monthStr === '09' ? 9 : monthStr === '06' ? 6 : 3,
      ...labelRecord(raw),
    });
  }
  merged.sort((a, b) => (a.report_date < b.report_date ? 1 : -1));
  return merged;
}

export interface BizItem {
  name: string;
  income: number;
  ratio: number;
  gpr: number;
}

/** 主营构成（按产品） */
export async function getBusiness(secid: string): Promise<{ year: string; items: BizItem[] }> {
  const secuCode = stockIdToSecuCode(secid);
  const data = await emGet('https://datacenter.eastmoney.com/securities/api/data/v1/get', {
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
  const list = makeArray<Record<string, string | number>>(data?.result?.data).filter(
    (i) => String(i.MAINOP_TYPE) === '2',
  );
  const lastAnnual = list
    .filter((i) => String(i.REPORT_DATE).split(' ')[0].split('-')[1] === '12')
    .sort((a, b) => (String(a.REPORT_DATE) < String(b.REPORT_DATE) ? 1 : -1))[0];
  const year = lastAnnual ? String(lastAnnual.REPORT_DATE).split(' ')[0].split('-')[0] : '';
  const items = list
    .filter(
      (i) =>
        String(i.REPORT_DATE).startsWith(`${year}-12-31`) || String(i.REPORT_DATE).startsWith(year),
    )
    .map((i) => ({
      name: String(i.ITEM_NAME),
      income: Number(i.MAIN_BUSINESS_INCOME),
      ratio: Number(i.MBI_RATIO),
      gpr: Number(i.GROSS_RPOFIT_RATIO),
    }))
    .sort((a, b) => b.income - a.income);
  return { year, items };
}

/** 分红历史 */
export async function getDividends(
  secid: string,
  years = 5,
): Promise<Record<string, string | number>[]> {
  const secuCode = stockIdToSecuCode(secid);
  const data = await emGet('https://datacenter.eastmoney.com/securities/api/data/v1/get', {
    reportName: 'RPT_F10_DIVIDEND_CURVE',
    columns: 'ALL',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: 1,
    pageSize: 200,
    sortTypes: 1,
    sortColumns: 'TRADE_DATE',
    source: 'HSF10',
    client: 'PC',
  });
  return makeArray<Record<string, string | number>>(data?.result?.data).slice(-years * 3);
}

// ============================================================
// 原始财务报告 PDF（年报/半年报/季报）
// ============================================================

export interface ReportPdfInfo {
  year: number;
  report_date: string;
  report_type: string;
  opinion_type: string;
  publish_situations: string;
  published: boolean;
}

/** 获取个股原始财务报告的 PDF 列表（对应东财 RPT_PCF10_ORIG_REPORT） */
export async function getReportPdfs(secid: string): Promise<ReportPdfInfo[]> {
  const secuCode = stockIdToSecuCode(secid);
  const data = await emGet('https://datacenter.eastmoney.com/securities/api/data/v1/get', {
    reportName: 'RPT_PCF10_ORIG_REPORT',
    columns:
      'YEAR,SECUCODE,SECURITY_CODE,REPORT_DATE,REPORT_TYPE,PUBLISH_SITUATIONS,OPINION_TYPE',
    filter: `(SECUCODE="${secuCode}")`,
    pageNumber: 1,
    sortTypes: -1,
    sortColumns: 'REPORT_DATE',
    source: 'HSF10',
    client: 'PC',
  });
  return makeArray<Record<string, string | number>>(data?.result?.data).map((item) => {
    const publish = String(item.PUBLISH_SITUATIONS ?? '');
    return {
      year: Number(item.YEAR),
      report_date: String(item.REPORT_DATE ?? '').split(' ')[0],
      report_type: String(item.REPORT_TYPE ?? ''),
      opinion_type: String(item.OPINION_TYPE ?? ''),
      publish_situations: publish,
      published: publish.startsWith('AN'),
    };
  });
}

/** 根据 publish_situations 获取财报 PDF 的下载地址（对应东财 np-cnotice-stock ann 接口） */
export async function getReportPdfUrl(publishSituation: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await emGet('https://np-cnotice-stock.eastmoney.com/api/content/ann', {
    art_code: publishSituation,
    client_source: 'web',
    page_index: '1',
  });
  const attachUrl = body?.data?.attach_url;
  return typeof attachUrl === 'string' ? attachUrl : '';
}
