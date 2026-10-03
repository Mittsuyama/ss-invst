import { describe, it, expect } from 'vitest';
import { computePinbars, formatPercent, type PinbarBar } from './pinbar';

const bar = (open: number, high: number, low: number, close: number): PinbarBar => ({
  open,
  high,
  low,
  close,
});

/** A：多头 pinbar 后移动止损被抬到入场价之上 → 成功 */
const A: PinbarBar[] = [
  bar(100, 105, 99, 104),
  bar(104, 105, 95, 103),
  bar(110, 112, 110, 111),
  bar(113, 116, 115, 115),
  bar(112, 112, 108, 109),
  bar(108, 110, 105, 106),
];

/** B：多头 pinbar 后立刻打到初始止损 → 失败 */
const B: PinbarBar[] = [
  bar(100, 105, 99, 104),
  bar(104, 105, 95, 103),
  bar(102, 103, 94, 95),
  bar(95, 97, 93, 96),
];

/** C：空头 pinbar（上影线）→ 失败 */
const C: PinbarBar[] = [bar(100, 104, 99, 100), bar(100, 110, 100, 101), bar(101, 111, 100, 110)];

/** D：第一条 pinbar 永不触发止损（进行中），index 5 的有效 pinbar 应被截断 */
const D: PinbarBar[] = [
  bar(100, 105, 99, 104),
  bar(104, 105, 95, 103),
  bar(110, 112, 110, 111),
  bar(113, 116, 115, 115),
  bar(115, 120, 117, 119),
  bar(117.5, 119, 113.5, 117.5),
  bar(117.5, 121, 118, 120),
  bar(120, 122, 119, 121),
];

/** E：中等下影线（6/7 ≈ 0.857），用于验证 wickRatio 参数 */
const E: PinbarBar[] = [bar(100, 105, 99, 104), bar(104, 105, 98, 104)];

describe('computePinbars', () => {
  it('A 激进档：移动止损抬到入场价之上 → 成功', () => {
    expect(computePinbars(A, { stopMode: 'aggressive' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 4,
        profit: 0.055825242718446605,
        result: 'success',
        stopPrice: 108.75,
      },
    ]);
  });

  it('A 保守档：初始止损取影线 61.8% 处', () => {
    expect(computePinbars(A, { stopMode: 'conservative' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 4,
        profit: 0.0632427184466019,
        result: 'success',
        stopPrice: 109.514,
      },
    ]);
  });

  it('B 激进档：立刻打到初始止损（做多极值）→ 失败', () => {
    expect(computePinbars(B, { stopMode: 'aggressive' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 2,
        profit: -0.07766990291262135,
        result: 'failed',
        stopPrice: 95,
      },
    ]);
  });

  it('B 保守档：止损更近，亏损更小', () => {
    expect(computePinbars(B, { stopMode: 'conservative' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 2,
        profit: -0.04800000000000003,
        result: 'failed',
        stopPrice: 98.056,
      },
    ]);
  });

  it('C 激进档：空头 pinbar 做空 → 失败', () => {
    expect(computePinbars(C, { stopMode: 'aggressive' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'short',
        endIndex: 2,
        profit: -0.0891089108910891,
        result: 'failed',
        stopPrice: 110,
      },
    ]);
  });

  it('C 保守档：空头止损取上影线 61.8% 处', () => {
    expect(computePinbars(C, { stopMode: 'conservative' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'short',
        endIndex: 2,
        profit: -0.05506930693069305,
        result: 'failed',
        stopPrice: 106.562,
      },
    ]);
  });

  it('D 激进档：首个进行中的 pinbar 之后不再生成新记录', () => {
    const records = computePinbars(D, { stopMode: 'aggressive' });
    expect(records).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 7,
        profit: 0,
        result: 'in-progress',
        stopPrice: 117.296875,
      },
    ]);
    // index 5 是一个形态有效的多头 pinbar，但被上面这条进行中记录的区间截断
    expect(records.some((r) => r.index === 5)).toBe(false);
  });

  it('D 保守档：同样截断，止损位不同', () => {
    expect(computePinbars(D, { stopMode: 'conservative' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 7,
        profit: 0,
        result: 'in-progress',
        stopPrice: 117.34462500000001,
      },
    ]);
  });

  it('E：wickRatio 可调，收紧阈值后不再命中', () => {
    expect(computePinbars(E, { stopMode: 'aggressive' })).toEqual([
      {
        index: 1,
        leftEyeIndex: 0,
        direction: 'long',
        endIndex: 1,
        profit: 0,
        result: 'in-progress',
        stopPrice: 98,
      },
    ]);
    expect(computePinbars(E, { stopMode: 'aggressive', wickRatio: 0.9 })).toEqual([]);
  });
});

describe('formatPercent', () => {
  it('盈亏比例格式化为百分比文本', () => {
    expect(formatPercent(0.055825242718446605)).toBe('5.6%');
    expect(formatPercent(-0.07766990291262135)).toBe('-7.8%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.0632427184466019)).toBe('6.3%');
  });
});
