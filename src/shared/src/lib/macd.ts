/**
 * MACD (Moving Average Convergence Divergence) 计算
 *
 * 标准 MACD 指标:
 *   DIF  = EMA(close, shortPeriod) - EMA(close, longPeriod)
 *   DEA  = EMA(DIF, signalPeriod)
 *   MACD = 2 × (DIF - DEA)
 *
 * 默认参数: shortPeriod=12, longPeriod=26, signalPeriod=9
 */

/** EMA 初始值使用递归平滑，第一个值以首个 close 为种子 */
function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result[i] = values[0];
    } else {
      result[i] = values[i] * k + result[i - 1] * (1 - k);
    }
  }
  return result;
}

export interface MACDItem {
  /** DIF (快线) */
  dif: number;
  /** DEA (慢线 / 信号线) */
  dea: number;
  /** 柱状图高度 (2*(DIF-DEA)) */
  macd: number;
}

/**
 * 计算 MACD 指标序列
 * @param closes 收盘价序列
 * @param shortPeriod 快线周期，默认 12
 * @param longPeriod 慢线周期，默认 26
 * @param signalPeriod 信号线周期，默认 9
 * @returns 与输入等长的 MACDItem 数组
 */
export function computeMACD(
  closes: number[],
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9,
): MACDItem[] {
  const n = closes.length;
  if (n === 0) return [];

  const emaShort = calcEMA(closes, shortPeriod);
  const emaLong = calcEMA(closes, longPeriod);

  const difs = emaShort.map((s, i) => s - emaLong[i]);
  const deas = calcEMA(difs, signalPeriod);
  const macds = difs.map((d, i) => 2 * (d - deas[i]));

  return difs.map((dif, i) => ({
    dif: round3(dif),
    dea: round3(deas[i]),
    macd: round3(macds[i]),
  }));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
