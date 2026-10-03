import { describe, it, expect } from 'vitest';
import type { FactorSignal } from './index';
import { summarizeMeta } from './meta-summary';

const sig = (result: string, profit?: number): FactorSignal => ({
  date: '2024-01-01',
  type: 'buy',
  price: 1,
  reason: '',
  meta: profit === undefined ? { result } : { result, profit },
});

describe('summarizeMeta', () => {
  it('汇总结局计数、胜率与平均盈亏；进行中不计入胜率', () => {
    const summary = summarizeMeta([
      sig('success', 0.1),
      sig('success', 0.2),
      sig('failed', -0.1),
      sig('in-progress'),
    ]);
    expect(summary?.resultCounts).toEqual({ success: 2, failed: 1, 'in-progress': 1 });
    expect(summary?.winRate).toBeCloseTo(2 / 3, 10);
    expect(summary?.avgProfit).toBeCloseTo(0.2 / 3, 10);
  });

  it('全部进行中时胜率与平均盈亏为 null', () => {
    const summary = summarizeMeta([sig('in-progress'), sig('in-progress')]);
    expect(summary?.resultCounts).toEqual({ 'in-progress': 2 });
    expect(summary?.winRate).toBeNull();
    expect(summary?.avgProfit).toBeNull();
  });

  it('没有可汇总的 meta.result 时返回 undefined', () => {
    expect(summarizeMeta([])).toBeUndefined();
    expect(
      summarizeMeta([{ date: '2024-01-01', type: 'buy', price: 1, reason: '' }]),
    ).toBeUndefined();
    expect(summarizeMeta([sig('whatever')])?.resultCounts).toEqual({ whatever: 1 });
  });
});
