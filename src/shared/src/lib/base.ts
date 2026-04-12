/** 基础工具函数 */

/** 计算 EMA */
export const computeEMA = (values: number[], period: number) => {
  const ema: number[] = [];
  let emaValue = 0;
  for (const value of values) {
    emaValue = (1 - 2 / period) * value + (2 / period) * emaValue;
    ema.push(emaValue);
  }
  return ema;
};

/** 计算 MA */
export const computeMA = (values: number[], period: number) => {
  const ma: number[] = [];
  // 使用迭代法计算
  let maValue = 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i];
    } else {
      sum = sum - values[i - period] + values[i];
    }
    maValue = sum / period;
    ma.push(maValue);
  }
};
