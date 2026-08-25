/**
 * 「关键行情区间」（key move）：一段主升浪或大幅下跌的区间。
 * 由 get_key_moves 工具计算并推送给渲染进程，点击后打开抽屉画 K 线。
 */

/** 证券标的（后续可扩展：市场、行业、最新价等） */
export interface KeyMoveSecurity {
  /** 东财 secid，如 1.600519 */
  id: string;
  /** 代码，如 600519 */
  code: string;
  /** 名称，如 贵州茅台 */
  name: string;
}

/** 一个关键行情区间（主升/主跌段） */
export interface KeyMove {
  /** 稳定 key（`${start}~${end}`），用于列表渲染与点击定位 */
  key: string;
  /** 起始日期 YYYY-MM-DD */
  start: string;
  /** 结束日期 YYYY-MM-DD */
  end: string;
  startPrice: number;
  endPrice: number;
  /** 总涨跌幅 %，正 = 主升，负 = 主跌 */
  changeRate: number;
}

/** 一只证券 + 其关键行情区间列表（事件 payload 与气泡卡片共用） */
export interface KeyMoveList {
  security: KeyMoveSecurity;
  items: KeyMove[];
}

/** 持久化条目：按 toolCallId 关联到产生它的那轮工具调用（历史还原用） */
export interface KeyMoveEntry extends KeyMoveList {
  toolCallId: string;
}
