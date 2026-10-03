/**
 * ============================================================================
 * Pinbar（长影线反转形态）计算与历史回测
 * ============================================================================
 *
 * ## 一、Pinbar 定义
 * - 空头 pinbar（看跌，做空）：最高价与「开/收盘孰高」之差 > 整根 K 线长度
 *   （最高价 - 最低价）的 2/3，即上影线超过整根 K 线的 2/3。
 * - 多头 pinbar（看涨，做多）：「开/收盘孰低」与最低价之差 > 整根 K 线长度的 2/3，
 *   即下影线超过整根 K 线的 2/3。
 *
 * ## 二、有效性判断（依赖左眼 = 左侧相邻 K 线）
 * 以下条件同时满足才视为「有效 pinbar」：
 * 1. 显眼：左眼总长度（最高 - 最低）< pinbar 总长度（最高 - 最低）。
 * 2. 拒绝跳空：左眼包含 pinbar 实体：左眼最高 > pinbar「开/收盘孰高」，
 *    且左眼最低 < pinbar「开/收盘孰低」。
 *
 * ## 三、历史回测与移动止损
 * 找到有效 pinbar 后，从 pinbar 收盘价入场，计算到达结束位置时的盈亏比例：
 * - 初始止损 s(0) 是 t0（pinbar 当天）的某个价格，分为两档（函数参数，可调）：
 *     - 激进（aggressive）：pinbar 极值（多头 = 最低价，空头 = 最高价）。
 *     - 保守（conservative）：影线的 61.8% 处，即距极值占整条影线的 38.2%。
 * - 第 i 天：若当天触发止损线则结束；否则止损位
 *       s(i) = s(i-1) * 1/2 + p(i) * 1/2，
 *     其中 p(i) 做空取最高价、做多取最低价。
 * - 盈亏比例：多头 (结束价 - 收盘价) / 收盘价，空头 (收盘价 - 结束价) / 收盘价。
 *
 * ## 四、回测区间分类
 * - 失败（failed）：触发止损且收益 < 0。
 * - 成功（success）：触发止损且收益 > 0。
 * - 进行中（in-progress）：未触发止损，但 K 线已到最后一根。
 *
 * 本模块只做「算法 + 回测」，不含任何图表库依赖：
 * 渲染层把它转成 overlay（见 renderer 的 Chart/pinbar.ts），
 * agent 把它映射成因子信号（见 main/agent/factors/pinbar.ts）。
 * ============================================================================
 */

export type PinbarDirection = 'long' | 'short';
export type PinbarStopMode = 'aggressive' | 'conservative';
export type PinbarResultType = 'failed' | 'success' | 'in-progress';

/** 计算所需的最小 K 线字段；记录用下标定位，因此不需要时间戳 */
export interface PinbarBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PinbarOptions {
  /** 止损档位：激进 / 保守 */
  stopMode: PinbarStopMode;
  /** 影线占比阈值，默认 2/3 */
  wickRatio?: number;
}

export interface PinbarRecord {
  /** pinbar 在 list 中的索引 */
  index: number;
  /** 左眼在 list 中的索引（index - 1） */
  leftEyeIndex: number;
  direction: PinbarDirection;
  /** 结束位置在 list 中的索引（触发止损当天 / 最后一根） */
  endIndex: number;
  /** 盈亏比例（进行中为 0） */
  profit: number;
  result: PinbarResultType;
  /**
   * 结束时的止损位：触发止损当天的止损位；进行中则为最后一根 K 线时的止损位。
   * 注意这**不是**初始止损 s(0)（原代码注释误写为「初始止损价」，搬迁时已改正）。
   */
  stopPrice: number;
}

/** 影线占比阈值默认值；对外导出，供调用方（如 agent 因子）复用同一份而非各自重写 */
export const DEFAULT_WICK_RATIO = 2 / 3;

function detectDirection(item: PinbarBar, wickRatio: number): PinbarDirection | null {
  const range = item.high - item.low;
  if (range <= 0) {
    return null;
  }
  const bodyHigh = Math.max(item.open, item.close);
  const bodyLow = Math.min(item.open, item.close);
  const threshold = range * wickRatio;
  if (item.high - bodyHigh > threshold) {
    return 'short';
  }
  if (bodyLow - item.low > threshold) {
    return 'long';
  }
  return null;
}

function isValidPinbar(pinbar: PinbarBar, leftEye: PinbarBar): boolean {
  // 1. 显眼：左眼总长度 < pinbar 总长度
  if (leftEye.high - leftEye.low >= pinbar.high - pinbar.low) {
    return false;
  }
  // 2. 拒绝跳空：左眼包含 pinbar 实体
  const bodyHigh = Math.max(pinbar.open, pinbar.close);
  const bodyLow = Math.min(pinbar.open, pinbar.close);
  return leftEye.high > bodyHigh && leftEye.low < bodyLow;
}

function initialStopPrice(
  pinbar: PinbarBar,
  direction: PinbarDirection,
  stopMode: PinbarStopMode,
): number {
  if (stopMode === 'aggressive') {
    return direction === 'long' ? pinbar.low : pinbar.high;
  }
  // 保守：影线 61.8% 处，即距极值占整条影线的 38.2%
  const bodyHigh = Math.max(pinbar.open, pinbar.close);
  const bodyLow = Math.min(pinbar.open, pinbar.close);
  const shadow = direction === 'long' ? bodyLow - pinbar.low : pinbar.high - bodyHigh;
  return direction === 'long' ? pinbar.low + shadow * 0.382 : pinbar.high - shadow * 0.382;
}

function runBacktest(
  list: PinbarBar[],
  pinbarIndex: number,
  direction: PinbarDirection,
  stopMode: PinbarStopMode,
): Pick<PinbarRecord, 'endIndex' | 'profit' | 'result' | 'stopPrice'> {
  const pinbar = list[pinbarIndex];
  const entry = pinbar.close;
  let stop = initialStopPrice(pinbar, direction, stopMode);

  for (let i = pinbarIndex + 1; i < list.length; i++) {
    const bar = list[i];
    if (direction === 'long') {
      if (bar.low <= stop) {
        const profit = (stop - entry) / entry;
        return {
          endIndex: i,
          profit,
          result: profit < 0 ? 'failed' : 'success',
          stopPrice: stop,
        };
      }
      stop = stop * (1 / 2) + bar.low * (1 / 2);
    } else {
      if (bar.high >= stop) {
        const profit = (entry - stop) / entry;
        return {
          endIndex: i,
          profit,
          result: profit < 0 ? 'failed' : 'success',
          stopPrice: stop,
        };
      }
      stop = stop * (1 / 2) + bar.high * (1 / 2);
    }
  }

  return {
    endIndex: list.length - 1,
    profit: 0,
    result: 'in-progress',
    stopPrice: stop,
  };
}

/** 找到所有有效 pinbar，并对其做移动止损回测。 */
export function computePinbars(list: PinbarBar[], options: PinbarOptions): PinbarRecord[] {
  const { stopMode } = options;
  const wickRatio = options.wickRatio ?? DEFAULT_WICK_RATIO;
  const records: PinbarRecord[] = [];

  for (let i = 1; i < list.length; i++) {
    const pinbar = list[i];
    const leftEye = list[i - 1];
    const direction = detectDirection(pinbar, wickRatio);
    if (!direction) {
      continue;
    }
    if (!isValidPinbar(pinbar, leftEye)) {
      continue;
    }

    const backtest = runBacktest(list, i, direction, stopMode);
    records.push({
      index: i,
      leftEyeIndex: i - 1,
      direction,
      ...backtest,
    });

    // 已遇到「进行中」（未触发止损）的有效 pinbar，其区间一直延伸到最后一根 K 线，
    // 后续 pinbar 都会与其重叠，因此不再生成新的区域
    if (backtest.result === 'in-progress') {
      break;
    }
  }

  return records;
}

/** 将盈亏比例格式化为百分比文本，例如 0.23 -> "23%"、-0.15 -> "-15%"。 */
export function formatPercent(profit: number): string {
  return `${(profit * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
