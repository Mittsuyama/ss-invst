import type { FactorBar, FactorSignal } from './index';
import { computePinbars, formatPercent, type PinbarResultType } from '@shared/lib/pinbar';

/** 影线占比阈值参数 key */
export const PINBAR_WICK_RATIO_KEY = 'wickRatio';
export const PINBAR_DEFAULT_WICK_RATIO = 2 / 3;

/** 结局文案；in-progress 单独处理，故这里只覆盖已结束的两种 */
function outcomeText(result: PinbarResultType, profit: number, endDate: string): string {
  if (result === 'in-progress') {
    return `移动止损结局：进行中（未触发止损，至 ${endDate}）`;
  }
  const label = result === 'success' ? '成功' : '失败';
  return `移动止损结局：${label} ${formatPercent(profit)}（至 ${endDate}）`;
}

/**
 * pinbar 因子：形态识别 + 移动止损回测全部复用 @shared/lib/pinbar（与图表 overlay 同源）。
 * 止损档位固定 aggressive（与渲染层现状一致），只暴露影线阈值 wickRatio。
 */
export function pinbarFactor(bars: FactorBar[], params: Record<string, number>): FactorSignal[] {
  const raw = params[PINBAR_WICK_RATIO_KEY];
  const wickRatio =
    typeof raw === 'number' && Number.isFinite(raw) ? raw : PINBAR_DEFAULT_WICK_RATIO;

  return computePinbars(bars, { stopMode: 'aggressive', wickRatio }).map((record): FactorSignal => {
    const entryBar = bars[record.index];
    const endBar = bars[record.endIndex];
    const isLong = record.direction === 'long';
    const head = `${isLong ? '多头（下影线）' : '空头（上影线）'} pinbar 入场，结束止损位 ${record.stopPrice}`;
    return {
      date: entryBar.date,
      type: isLong ? 'buy' : 'sell',
      price: entryBar.close,
      reason: `${head}；${outcomeText(record.result, record.profit, endBar.date)}`,
      meta: {
        direction: record.direction,
        stopPrice: record.stopPrice,
        endDate: endBar.date,
        result: record.result,
        profit: record.profit,
      },
    };
  });
}
