export enum DataDirecotry {
  /** 缓存的基础信息 */
  PROFILE_LIST_CACHE = 'cache/profile',

  /** 缓存的研究报告 */
  RESEARCH_REPORT_CACHE = 'cache/research-report',

  /** 基础数据 */
  BASE = 'base',

  /** 读书笔记 */
  NOTES = 'notes',
}

export enum FileName {
  /** 收藏的股票 id 列表 */
  FAVORITE_STOCK_ID_LIST = 'favorite-stock-id-list.json',

  /** 基础信息 */
  PROFILE_STOCK_LIST = 'profile-stock-list.json',

  /** 评分 */
  RATING = 'rating.json',

  /** 评论 */
  REVIEW = 'review.json',

  /** 黑名单列表 */
  BLACKLIST = 'black-list.json',

  /** 个股研报列表 */
  STOCK_RESEARCH_REPORT_LIST = 'stock-research-report-list.json',

  /** 行业研报列表 */
  INDUSTRY_RESEARCH_REPORT_LIST = 'industry-research-report-list.json',
}
