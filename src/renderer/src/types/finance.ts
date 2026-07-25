import type { StockInfo } from '@shared/types/stock';

export type ReportMonth = 3 | 6 | 9 | 12;

export interface FinancialReport {
  month: ReportMonth;
  year: number;
  /** 原始数据，key 为 ACCOUNT_ITEM 的 value（如 'INVENTORY'） */
  data: Record<string, string | number | undefined>;
}

export type BalanceSheetType =
  | 'asset'
  | 'debt'
  | 'current-asset'
  | 'current-debt'
  | 'non-currnet-asset'
  | 'non-current-debt';

export type CashFlowStatementType = 'operate' | 'invest' | 'finance';

export interface BizItem {
  SECUCODE: string;
  SECURITY_CODE: string;
  /** 2023-06-30 00:00:00 */
  REPORT_DATE: string;
  /** 1 2 3 */
  MAINOP_TYPE: string;
  /** 茅台酒 */
  ITEM_NAME: string;
  /** 59278599200 */
  MAIN_BUSINESS_INCOME: number;
  /** 0.851998 */
  MBI_RATIO: number;
  /** 1 2 3... */
  RANK: number;
  /** 毛利率 */
  GROSS_RPOFIT_RATIO: number;
}

export interface BaseInfo {
  /** 东财行业 */
  industryDetail: string;
  /** 公司简介 */
  profile: string;
  /** 许可项目 */
  scope: string;
  /** 会计师事务所 */
  accountFirm: string;
}

export interface NoticeItem {
  title: string;
  code: string;
  date: string;
}

/** 带财报详情的股票信息（基于 StockInfo 扩展） */
export interface StockWithReportsDetail extends StockInfo {
  /** 简易计算的近三年平均自由现金流 */
  fcfAvg3: number;
  /** 简易计算的自由现金流 */
  fcf: number;
  /** 毛利率标准差 */
  gprStd: number;
  /** ROE 标准差 */
  roeStd: number;
  /** 上年年末 roe */
  lastYearRoe: number;
  /** 财务报表 */
  reports: FinancialReport[];
}
