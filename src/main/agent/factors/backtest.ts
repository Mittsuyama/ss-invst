import type { FactorBar, FactorSignal } from './index';

export interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  ret: number;
  exitReason: string;
}

export interface BacktestStats {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

/**
 * 事件驱动回测：每个 buy 信号买入，到下一个 sell 信号（或持有 holdBars 根）卖出。
 * 返回胜率、赔率（profit factor）、平均盈亏与明细。
 */
export function evaluateSignals(
  bars: FactorBar[],
  signals: FactorSignal[],
  holdBars = 20,
): { stats: BacktestStats; trades: Trade[] } {
  const idxByDate = new Map<string, number>();
  bars.forEach((b, i) => idxByDate.set(b.date, i));

  const buys = signals.filter((s) => s.type === 'buy');
  const sells = signals.filter((s) => s.type === 'sell');

  const trades: Trade[] = [];
  for (const buy of buys) {
    const buyIdx = idxByDate.get(buy.date);
    if (buyIdx === undefined) continue;

    let exitIdx: number | undefined;
    let exitPrice: number;
    let exitReason: string;

    const nextSell = sells.find((s) => {
      const i = idxByDate.get(s.date);
      return i !== undefined && i > buyIdx && i - buyIdx <= holdBars;
    });

    if (nextSell) {
      exitIdx = idxByDate.get(nextSell.date)!;
      exitPrice = nextSell.price;
      exitReason = '卖出信号';
    } else {
      exitIdx = Math.min(buyIdx + holdBars, bars.length - 1);
      exitPrice = bars[exitIdx].close;
      exitReason = `持有 ${holdBars} 根到期`;
    }

    const ret = (exitPrice - buy.price) / buy.price;
    trades.push({
      entryDate: buy.date,
      exitDate: bars[exitIdx].date,
      entryPrice: buy.price,
      exitPrice,
      ret,
      exitReason,
    });
  }

  const wins = trades.filter((t) => t.ret > 0);
  const losses = trades.filter((t) => t.ret <= 0);
  const totalWin = wins.reduce((s, t) => s + t.ret, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.ret, 0));

  const stats: BacktestStats = {
    totalTrades: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    avgWin: wins.length ? totalWin / wins.length : 0,
    avgLoss: losses.length ? -totalLoss / losses.length : 0,
  };

  return { stats, trades };
}
