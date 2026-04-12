/** 知行合一指标计算 */
import { computeEMA, computeMA } from './base';

/** 知行趋势线
 *  1. 知行短期趋势线 = ema(ema(close, 10), 10)
 *  2. 知行长期趋势线 = (ma(close, m1) + ma(close, m2) + ma(close, m3) + ma(close, m4)) / 4
 *  3. 其中默认参数，m1 = 14, m2 = 28, m3 = 47, m4 = 144
 */
export const computeZxTrendLine = (values: number[]) => {
  const ema = computeEMA(values, 10);
  const shortTrendItems = computeEMA(ema, 10);
  const ma = computeMA(values, 14);
  const ma2 = computeMA(values, 28);
  const ma3 = computeMA(values, 47);
  const ma4 = computeMA(values, 144);
  const longTrendItems = Array.from({ length: values.length }, (_, i) => {
    return (ma[i] + ma2[i] + ma3[i] + ma4[i]) / 4;
  });
  return {
    short: shortTrendItems,
    long: longTrendItems,
  };
};
