import type { FactorSignal } from './index';

export interface MetaSummary {
  /** 各 result 出现的次数，例如 { success: 2, failed: 1, 'in-progress': 1 } */
  resultCounts: Record<string, number>;
  /** 胜率：success / (success + failed)；无已结束样本时为 null */
  winRate: number | null;
  /** 已结束样本的平均盈亏比例；无可用样本时为 null */
  avgProfit: number | null;
}

/**
 * 汇总信号 meta 里的回测结局（result / profit）。
 * 只有带字符串 meta.result 的信号才参与统计，因此普通因子（如 macd_cross）返回 undefined。
 */
export function summarizeMeta(signals: FactorSignal[]): MetaSummary | undefined {
  const resultCounts: Record<string, number> = {};
  const decidedProfits: number[] = [];
  let decided = 0;

  for (const signal of signals) {
    const result = signal.meta?.result;
    if (typeof result !== 'string') continue;
    resultCounts[result] = (resultCounts[result] ?? 0) + 1;
    // 进行中尚未结束，不参与胜率与平均盈亏
    if (result === 'in-progress') continue;
    decided += 1;
    const profit = signal.meta?.profit;
    if (typeof profit === 'number' && Number.isFinite(profit)) {
      decidedProfits.push(profit);
    }
  }

  if (Object.keys(resultCounts).length === 0) return undefined;

  const successes = resultCounts.success ?? 0;
  const total = decidedProfits.reduce((sum, p) => sum + p, 0);

  return {
    resultCounts,
    winRate: decided > 0 ? successes / decided : null,
    avgProfit: decidedProfits.length > 0 ? total / decidedProfits.length : null,
  };
}
