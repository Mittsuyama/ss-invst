import dayjs from 'dayjs';
import { request } from '@/lib/request';
import { RequestType } from '@shared/types/request';

// ============================================================
// 大事提醒（股票日历）相关 API
// 数据来源: datacenter-web.eastmoney.com
// ============================================================

/** 大事提醒事件类型码 */
export const EVENT_TYPE_CODE = {
  /** 业绩预告 */
  PERFORMANCE_FORECAST: '001',
  /** 业绩快报 */
  PERFORMANCE_EXPRESS: '002',
  /** 分红送转 */
  DIVIDEND: '003',
  /** 股东大会 */
  SHAREHOLDER_MEETING: '004',
  /** 机构调研 */
  INSTITUTIONAL_RESEARCH: '005',
  /** 预约披露日 */
  SCHEDULED_DISCLOSURE: '006',
  /** 限售解禁 */
  LOCKUP_EXPIRY: '007',
  /** 停复牌 */
  SUSPENSION_RESUMPTION: '008',
  /** 龙虎榜 */
  DRAGON_TIGER: '009',
  /** 大宗交易 */
  BLOCK_TRADE: '010',
  /** 融资融券 */
  MARGIN_TRADING: '011',
  /** 增发 */
  ADDITIONAL_ISSUANCE: '012',
  /** 配股 */
  RIGHTS_ISSUE: '013',
  /** 股权质押 */
  EQUITY_PLEDGE: '014',
  /** 股权收购 */
  EQUITY_ACQUISITION: '015',
  /** 对外投资 */
  EXTERNAL_INVESTMENT: '016',
  /** 诉讼仲裁 */
  LITIGATION_ARBITRATION: '017',
  /** 担保 */
  GUARANTEE: '018',
  /** 公告 */
  ANNOUNCEMENT: '019',
  /** 研报 */
  RESEARCH_REPORT: '020',
  /** 投资者关系 */
  INVESTOR_RELATIONS: '021',
  /** 可转债 */
  CONVERTIBLE_BOND: '022',
  /** 新股申购 */
  IPO_SUBSCRIPTION: '023',
  /** 新股上市 */
  IPO_LISTING: '024',
  /** 退市整理期 */
  DELISTING_PERIOD: '025',
  /** 风险警示 */
  RISK_WARNING: '026',
} as const;

export type EventTypeCode = (typeof EVENT_TYPE_CODE)[keyof typeof EVENT_TYPE_CODE];

/** 大事提醒单条数据 */
export interface CalendarEvent {
  /** 证券唯一码，如 "603444.SH" */
  SECUCODE: string;
  /** 证券代码 */
  SECURITY_CODE: string;
  /** 证券内部编码 */
  SECURITY_INNER_CODE: string;
  /** 机构编码 */
  ORG_CODE: string;
  /** 通知日期 */
  NOTICE_DATE: string;
  /** 信息编码（公告/研报等有具体内容时） */
  INFO_CODE: string | null;
  /** 事件类型中文名 */
  EVENT_TYPE: string;
  /** 事件类型码 */
  EVENT_TYPE_CODE: EventTypeCode;
  /** 事件描述内容 */
  LEVEL1_CONTENT: string;
  /** 当日涨跌幅(%)，可能为 null */
  CHANGE_RATE: number | null;
  /** 当日收盘价，可能为 null */
  CLOSE_PRICE: number | null;
}

/** 大事提醒 API 原始响应 */
interface CalendarRawResponse {
  version: string;
  result: {
    pages: number;
    data: CalendarEvent[];
    count: number;
  };
  success: boolean;
  message: string;
  code: number;
}

/** 大事提醒查询参数 */
export interface FetchCalendarEventsParams {
  /** 证券代码，如 "603444" */
  code: string;
  /** 页码，从 1 开始 */
  pageNumber?: number;
  /** 每页条数，默认 50 */
  pageSize?: number;
  /** 截止日期（NOTICE_DATE <= endDate），格式 YYYY-MM-DD，默认当前日期 + 3 个月 */
  endDate?: string;
  /** 筛选特定事件类型，不传则返回全部类型 */
  eventTypeCodes?: EventTypeCode[];
}

/** 大事提醒查询结果 */
export interface FetchCalendarEventsResult {
  /** 事件列表 */
  list: CalendarEvent[];
  /** 总条数 */
  total: number;
  /** 总页数 */
  pages: number;
}

/**
 * 根据证券代码前缀推断市场
 */
function inferMarket(code: string): 'SH' | 'SZ' {
  if (code.startsWith('60') || code.startsWith('68')) {
    return 'SH';
  }
  if (code.startsWith('00') || code.startsWith('30')) {
    return 'SZ';
  }
  // 默认返回上海
  return 'SH';
}

/**
 * 所有已知的事件类型码列表（用于默认查询全部类型）
 */
const ALL_EVENT_TYPE_CODES: EventTypeCode[] = Object.values(EVENT_TYPE_CODE);

/**
 * 构建 filter 参数字符串
 * 东方财富 datacenter-web 接口使用括号包含的条件表达式：
 * (FIELD="VALUE")(FIELD in ("v1","v2",...))(FIELD<='DATE')
 */
function buildFilter(code: string, endDate: string, eventTypeCodes: EventTypeCode[]): string {
  const conditions: string[] = [
    `(SECURITY_CODE="${code}")`,
    `(EVENT_TYPE_CODE in (${eventTypeCodes.map((c) => `"${c}"`).join(',')}))`,
    `(NOTICE_DATE<='${endDate}')`,
  ];
  return conditions.join('');
}

/**
 * 获取单只股票的大事提醒列表
 *
 * @example
 * ```ts
 * // 获取吉比特最近的大事提醒
 * const result = await fetchCalendarEvents({
 *   code: '603444',
 *   pageSize: 10,
 * });
 *
 * // 只获取研报和公告
 * const result2 = await fetchCalendarEvents({
 *   code: '603444',
 *   eventTypeCodes: [EVENT_TYPE_CODE.RESEARCH_REPORT, EVENT_TYPE_CODE.ANNOUNCEMENT],
 * });
 * ```
 */
export async function fetchCalendarEvents(
  params: FetchCalendarEventsParams,
): Promise<FetchCalendarEventsResult> {
  const {
    code,
    pageNumber = 1,
    pageSize = 50,
    endDate = dayjs().add(3, 'month').format('YYYY-MM-DD'),
    eventTypeCodes = ALL_EVENT_TYPE_CODES,
  } = params;

  // 列定义（与东方财富接口保持一致）
  const columns = [
    'SECUCODE',
    'SECURITY_CODE',
    'SECURITY_INNER_CODE',
    'ORG_CODE',
    'NOTICE_DATE',
    'INFO_CODE',
    'EVENT_TYPE',
    'EVENT_TYPE_CODE',
    'LEVEL1_CONTENT',
    'CHANGE_RATE',
    'CLOSE_PRICE',
  ];

  const raw = (await request(
    RequestType.GET,
    'https://datacenter-web.eastmoney.com/api/data/v1/get',
    {
      reportName: 'RPT_STOCKCALENDAR',
      columns: columns.join(','),
      quoteColumns: '',
      filter: buildFilter(code, endDate, eventTypeCodes),
      pageNumber,
      pageSize,
      sortTypes: -1,
      sortColumns: 'NOTICE_DATE',
      source: 'QuoteWeb',
      client: 'WEB',
    },
  )) as CalendarRawResponse;

  return {
    list: raw.result.data ?? [],
    total: raw.result.count,
    pages: raw.result.pages,
  };
}
