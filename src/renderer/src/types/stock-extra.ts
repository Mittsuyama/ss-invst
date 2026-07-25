import type { ReportMonth } from './finance';

export interface DividendItem {
  DIVIDEND_7DAYS: number;
  DIVIDEND_RATIO_HYY: number;
  DIVIDEND_RATIO_YSS: number;
  IMPL_PLAN_PROFILE: string | null;
  IS_EX_DIVIDEND_DATE: '0' | '1';
  TRADE_DATE: string;
  YIELD_7DAYS: number;
  IS_SHOW: '1' | '0';
  SECUCODE: string;
  SECURITY_CODE: string;
  SECURITY_NAME_ABBR: string;
}

export interface ManagerItem {
  PERSON_NAME: string;
  SALARY: number;
  POSITION: string;
}

export interface ManagerHoldingChangeItem {
  END_DATE: string;
  EXECUTIVE_NAME: string;
  HOLDER_NAME: string;
  POSITION: string;
  CHANGE_AFTER_HOLDNUM: number;
  CHANGE_NUM: number;
  EXECUTIVE_RELATION: string;
  AVERAGE_PRICE: number;
}

export interface ReportOriginItem {
  OPINION_TYPE: string;
  PUBLISH_SITUATIONS: string;
  REPORT_DATE: string;
  REPORT_TYPE: string;
  SECUCODE: string;
  SECURITY_CODE: string;
  YEAR: number;
}

export interface ResearchReportItem {
  art_code: string;
  title: string;
  title_ch: string;
  title_en: string;
  publish_time: string;
}

export interface AttaceInfo {
  attach_url: string;
  attach_pages: number;
}

export interface BizItemData {
  year: number;
  month: ReportMonth;
  name: string;
  income: number;
  ratio: number;
  gpr: number;
}
