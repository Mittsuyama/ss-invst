import { describe, it, expect } from 'vitest';
import { FACTORS, describeFactors, type FactorBar } from './index';
import { pinbarFactor } from './pinbar';

const bar = (
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
): FactorBar => ({ date, open, high, low, close });

/** 与 shared 层 B 组同形：多头 pinbar 后立刻打到初始止损 */
const B: FactorBar[] = [
  bar('2024-01-02', 100, 105, 99, 104),
  bar('2024-01-03', 104, 105, 95, 103),
  bar('2024-01-04', 102, 103, 94, 95),
  bar('2024-01-05', 95, 97, 93, 96),
];

/** 与 shared 层 D 组同形：第一条 pinbar 永不触发止损（进行中） */
const D: FactorBar[] = [
  bar('2024-02-01', 100, 105, 99, 104),
  bar('2024-02-02', 104, 105, 95, 103),
  bar('2024-02-05', 110, 112, 110, 111),
  bar('2024-02-06', 113, 116, 115, 115),
  bar('2024-02-07', 115, 120, 117, 119),
  bar('2024-02-08', 117.5, 119, 113.5, 117.5),
  bar('2024-02-09', 117.5, 121, 118, 120),
  bar('2024-02-12', 120, 122, 119, 121),
];

describe('pinbar 因子', () => {
  it('多头 pinbar 映射为 buy 信号，并带上移动止损结果', () => {
    const signals = pinbarFactor(B, {});
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({
      date: '2024-01-03',
      type: 'buy',
      price: 103,
      reason: '多头（下影线） pinbar 入场，结束止损位 95；移动止损结局：失败 -7.8%（至 2024-01-04）',
      meta: {
        direction: 'long',
        stopPrice: 95,
        endDate: '2024-01-04',
        result: 'failed',
        profit: -0.07766990291262135,
      },
    });
  });

  it('进行中的记录仍然输出，reason 说明未触发止损', () => {
    const signals = pinbarFactor(D, {});
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('buy');
    expect(signals[0].date).toBe('2024-02-02');
    expect(signals[0].reason).toBe(
      '多头（下影线） pinbar 入场，结束止损位 117.296875；移动止损结局：进行中（未触发止损，至 2024-02-12）',
    );
    expect(signals[0].meta).toEqual({
      direction: 'long',
      stopPrice: 117.296875,
      endDate: '2024-02-12',
      result: 'in-progress',
      profit: 0,
    });
  });

  it('wickRatio 参数生效：阈值收紧后不再命中', () => {
    const E: FactorBar[] = [
      bar('2024-03-01', 100, 105, 99, 104),
      bar('2024-03-04', 104, 105, 98, 104),
    ];
    expect(pinbarFactor(E, {})).toHaveLength(1);
    expect(pinbarFactor(E, { wickRatio: 0.9 })).toHaveLength(0);
  });

  it('已注册为可用因子，且默认参数显示为可读数值', () => {
    expect(FACTORS.pinbar).toBeDefined();
    expect(FACTORS.pinbar.fn).toBe(pinbarFactor);
    expect(FACTORS.pinbar.params.map((p) => p.key)).toEqual(['wickRatio']);
    expect(describeFactors()).toContain('pinbar');
    expect(describeFactors()).toContain('wickRatio=0.6667');
    expect(describeFactors()).not.toContain('0.6666666666666666');
  });

  it('description 里写明结局是事后回测结果', () => {
    expect(FACTORS.pinbar.description).toContain('事后');
  });
});
