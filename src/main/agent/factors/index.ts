import { computeMACD } from '@shared/lib/macd';
import { computeRSI } from '../../utils/rsi';
import { computeMA, computeBOLL } from '../data/indicators';
import { PINBAR_DEFAULT_WICK_RATIO, PINBAR_WICK_RATIO_KEY, pinbarFactor } from './pinbar';

/** 因子计算所需的最小 K 线字段 */
export interface FactorBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface FactorSignal {
  date: string;
  type: 'buy' | 'sell';
  price: number;
  reason: string;
  /** 因子专属的结构化附注（如 pinbar 的移动止损结局），analyze_factor 会按 meta.result 聚合 */
  meta?: Record<string, number | string>;
}

export interface FactorParam {
  key: string;
  desc: string;
  default: number;
}

export interface FactorDef {
  name: string;
  description: string;
  params: FactorParam[];
  fn: (bars: FactorBar[], params: Record<string, number>) => FactorSignal[];
}

function num(params: Record<string, number>, key: string, def: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

function macdCross(bars: FactorBar[], params: Record<string, number>): FactorSignal[] {
  const fast = Math.round(num(params, 'fast', 12));
  const slow = Math.round(num(params, 'slow', 26));
  const signal = Math.round(num(params, 'signal', 9));
  const macd = computeMACD(bars.map((b) => b.close), fast, slow, signal);
  const out: FactorSignal[] = [];
  for (let i = 1; i < bars.length; i++) {
    const p = macd[i - 1];
    const c = macd[i];
    if (p.dif <= p.dea && c.dif > c.dea) {
      out.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: 'MACD 金叉' });
    } else if (p.dif >= p.dea && c.dif < c.dea) {
      out.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: 'MACD 死叉' });
    }
  }
  return out;
}

function maCross(bars: FactorBar[], params: Record<string, number>): FactorSignal[] {
  const short = Math.round(num(params, 'short', 5));
  const long = Math.round(num(params, 'long', 20));
  const s = computeMA(bars.map((b) => b.close), short);
  const l = computeMA(bars.map((b) => b.close), long);
  const out: FactorSignal[] = [];
  for (let i = 1; i < bars.length; i++) {
    const sPrev = s[i - 1];
    const sCur = s[i];
    const lPrev = l[i - 1];
    const lCur = l[i];
    if (sPrev == null || sCur == null || lPrev == null || lCur == null) continue;
    if (sPrev <= lPrev && sCur > lCur) {
      out.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `MA${short} 上穿 MA${long}` });
    } else if (sPrev >= lPrev && sCur < lCur) {
      out.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `MA${short} 下穿 MA${long}` });
    }
  }
  return out;
}

function rsiReversal(bars: FactorBar[], params: Record<string, number>): FactorSignal[] {
  const period = Math.round(num(params, 'period', 14));
  const oversold = num(params, 'oversold', 30);
  const overbought = num(params, 'overbought', 70);
  const rsi = computeRSI(bars.map((b) => b.close), period);
  const out: FactorSignal[] = [];
  for (let i = period + 1; i < bars.length; i++) {
    const cur = rsi[i - period];
    const prev = rsi[i - period - 1];
    if (prev >= oversold && cur < oversold) {
      out.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `RSI 跌破 ${oversold}（超卖）` });
    } else if (prev <= overbought && cur > overbought) {
      out.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `RSI 升破 ${overbought}（超买）` });
    }
  }
  return out;
}

function bollBreakout(bars: FactorBar[], params: Record<string, number>): FactorSignal[] {
  const period = Math.round(num(params, 'period', 20));
  const mult = num(params, 'mult', 2);
  const boll = computeBOLL(bars.map((b) => b.close), period, mult);
  const out: FactorSignal[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (boll.upper[i] == null || boll.lower[i] == null || boll.upper[i - 1] == null || boll.lower[i - 1] == null) continue;
    if (bars[i - 1].close >= boll.lower[i - 1]! && bars[i].close < boll.lower[i]!) {
      out.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: '跌破布林下轨（超卖）' });
    } else if (bars[i - 1].close <= boll.upper[i - 1]! && bars[i].close > boll.upper[i]!) {
      out.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: '升破布林上轨（超买）' });
    }
  }
  return out;
}

export const FACTORS: Record<string, FactorDef> = {
  macd_cross: {
    name: 'macd_cross',
    description: 'MACD 金叉/死叉',
    params: [
      { key: 'fast', desc: '快线周期', default: 12 },
      { key: 'slow', desc: '慢线周期', default: 26 },
      { key: 'signal', desc: '信号线周期', default: 9 },
    ],
    fn: macdCross,
  },
  ma_cross: {
    name: 'ma_cross',
    description: '双均线金叉/死叉',
    params: [
      { key: 'short', desc: '短期均线周期', default: 5 },
      { key: 'long', desc: '长期均线周期', default: 20 },
    ],
    fn: maCross,
  },
  rsi_reversal: {
    name: 'rsi_reversal',
    description: 'RSI 超买超卖反转',
    params: [
      { key: 'period', desc: 'RSI 周期', default: 14 },
      { key: 'oversold', desc: '超卖阈值', default: 30 },
      { key: 'overbought', desc: '超买阈值', default: 70 },
    ],
    fn: rsiReversal,
  },
  boll_breakout: {
    name: 'boll_breakout',
    description: '布林带突破',
    params: [
      { key: 'period', desc: '布林周期', default: 20 },
      { key: 'mult', desc: '标准差倍数', default: 2 },
    ],
    fn: bollBreakout,
  },
  pinbar: {
    name: 'pinbar',
    description:
      '长影线反转形态（pinbar）：下影线超长看多、上影线超长看空，并按移动止损规则给出历史回测结局。注意 result/profit/endDate 是入场之后的事后（forward-looking）回测结果，不是入场时可知的信息，请勿解读为当时即可预知；数据尾部一旦出现未触发止损的信号，更晚的 pinbar 不再输出（区间重叠）。analyze_factor 里的 stats 来自通用 holdBars 固定持有回测，metaSummary 来自 pinbar 原生移动止损结局，两者胜率口径不同、不可混用',
    params: [
      {
        key: PINBAR_WICK_RATIO_KEY,
        desc: '影线占整根 K 线比例阈值',
        default: PINBAR_DEFAULT_WICK_RATIO,
      },
    ],
    fn: pinbarFactor,
  },
};

/** 参数默认值显示：整数原样，非整数最多保留 4 位小数 */
function formatParamDefault(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
}

/** 所有因子名 + 描述 + 参数（供 LLM 参考） */
export function describeFactors(): string {
  return Object.values(FACTORS)
    .map((f) => {
      const p = f.params.map((x) => `${x.key}=${formatParamDefault(x.default)}`).join(',');
      return `${f.name}（${f.description}，参数 ${p}）`;
    })
    .join('；');
}
