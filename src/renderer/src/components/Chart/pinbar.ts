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
 * 1. 显著：左眼总长度（最高 - 最低）< pinbar 总长度（最高 - 最低）。
 * 2. 左眼包含 pinbar 实体：左眼最高 > pinbar「开/收盘孰高」，
 *    且左眼最低 < pinbar「开/收盘孰低」。
 *
 * ## 三、历史回测与移动止损
 * 找到有效 pinbar 后，从 pinbar 收盘价入场，计算到达结束位置时的盈亏比例：
 * - 初始止损 s(0) 是 t0（pinbar 当天）的某个价格，分为两档（函数参数，可调）：
 *     - 激进（aggressive）：pinbar 极值（多头 = 最低价，空头 = 最高价）。
 *     - 保守（conservative）：影线的 61.8% 处，即距极值占整条影线的 38.2%。
 * - 第 i 天：若当天触发止损线则结束；否则止损位
 *       s(i) = s(i-1) * 6/7 + p(i) * 1/7，
 *     其中 p(i) 做空取最高价、做多取最低价。
 * - 盈亏比例：多头 (结束价 - 收盘价) / 收盘价，空头 (收盘价 - 结束价) / 收盘价。
 *
 * ## 四、回测区间分类
 * - 失败（failed）：触发止损且收益 < 0。
 * - 成功（success）：触发止损且收益 > 0。
 * - 进行中（in-progress）：未触发止损，但 K 线已到最后一根。
 *
 * 绘制的区间矩形（深色边框 + 浅色底）从左眼最左侧起、到止损最右侧结束，
 * 颜色：失败 = 灰、成功 = 绿、进行中 = 黄。
 * ============================================================================
 */

import { OverlayCreate } from 'klinecharts';
import { PriceAndVolumeItem } from '@shared/types/stock';

export type PinbarDirection = 'long' | 'short';
export type PinbarStopMode = 'aggressive' | 'conservative';
export type PinbarResultType = 'failed' | 'success' | 'in-progress';

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
  /** 初始止损价 s(0) */
  stopPrice: number;
}

const DEFAULT_WICK_RATIO = 2 / 3;

/** 区间矩形颜色：失败 = 灰、成功 = 绿、进行中 = 黄（浅色底由 figure 派生） */
const PINBAR_RANGE_COLORS: Record<PinbarResultType, string> = {
  failed: '#8c8c8c',
  success: '#00a870',
  'in-progress': '#e6b800',
};

function detectDirection(item: PriceAndVolumeItem, wickRatio: number): PinbarDirection | null {
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

function isValidPinbar(pinbar: PriceAndVolumeItem, leftEye: PriceAndVolumeItem): boolean {
  // 1. 显著：左眼总长度 < pinbar 总长度
  if (leftEye.high - leftEye.low >= pinbar.high - pinbar.low) {
    return false;
  }
  // 2. 左眼包含 pinbar 实体
  const bodyHigh = Math.max(pinbar.open, pinbar.close);
  const bodyLow = Math.min(pinbar.open, pinbar.close);
  return leftEye.high > bodyHigh && leftEye.low < bodyLow;
}

function initialStopPrice(
  pinbar: PriceAndVolumeItem,
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
  list: PriceAndVolumeItem[],
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
      stop = stop * (6 / 7) + bar.low * (1 / 7);
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
      stop = stop * (6 / 7) + bar.high * (1 / 7);
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
export function computePinbars(list: PriceAndVolumeItem[], options: PinbarOptions): PinbarRecord[] {
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
function formatPercent(profit: number): string {
  return `${(profit * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/** 构建 pinbar 回测区间矩形 overlay：从 pinbar 左侧边起，到止损 K 线结束。 */
export function buildPinbarOverlays(
  list: PriceAndVolumeItem[],
  options: PinbarOptions,
  visible = true,
): OverlayCreate[] {
  return computePinbars(list, options).map((record): OverlayCreate => {
    const pinbar = list[record.index];
    const end = list[record.endIndex];
    const isLong = record.direction === 'long';
    // 做多：从 pinbar 最低点到止损 K 线最高点；做空相反（pinbar 最高点到止损 K 线最低点）
    const top = isLong ? end.high : pinbar.high;
    const bottom = isLong ? pinbar.low : end.low;
    return {
      visible,
      name: 'pinbarRange',
      paneId: 'candle_pane',
      lock: true,
      points: [
        { timestamp: pinbar.timestamp, value: top },
        { timestamp: end.timestamp, value: bottom },
      ],
      styles: {
        color: PINBAR_RANGE_COLORS[record.result],
      },
      // 盈亏比例文本，展示在矩形右下角
      extendData: formatPercent(record.profit),
    };
  });
}
