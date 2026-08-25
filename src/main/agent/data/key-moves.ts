import type { KeyMove, KeyMoveList } from '@shared/types/key-move';
import { searchSecurities, getKlines, type KlineRow } from './eastmoney';

/** 峰值/谷值判定的半窗口：前后各 20 根，共 41 根（不足时用部分窗口） */
const HALF_WINDOW = 20;
/** 保留比例：按 |涨跌幅| 降序取前 50% */
const KEEP_RATIO = 0.5;
/** 全部历史日 K 上限 */
const MAX_BARS = 2000;

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface Pivot {
  index: number;
  type: 'peak' | 'valley';
  price: number;
  date: string;
}

/**
 * 从日 K 行序列计算关键行情区间（纯函数，可单测）。
 * 1) 峰值：该根 high 是前后各 HALF_WINDOW 根（不足则部分窗口）里的最高；
 *    谷值：该根 low 是窗口里的最低。
 * 2) 相邻同类峰/谷去重（峰留更高、谷留更低），得到严格交替序列。
 * 3) 相邻峰谷连成一段，changeRate = (end-start)/start*100。
 * 4) 按 |changeRate| 降序取前 KEEP_RATIO。
 */
export function computeKeyMoves(rows: KlineRow[]): KeyMove[] {
  if (rows.length < 2) return [];

  const pivots: Pivot[] = [];
  for (let i = 0; i < rows.length; i++) {
    const lo = Math.max(0, i - HALF_WINDOW);
    const hi = Math.min(rows.length - 1, i + HALF_WINDOW);
    let isPeak = true;
    let isValley = true;
    for (let j = lo; j <= hi; j++) {
      if (rows[j].high > rows[i].high) isPeak = false;
      if (rows[j].low < rows[i].low) isValley = false;
      if (!isPeak && !isValley) break;
    }
    // 同一根既是峰又是谷（宽幅 K）极罕见：优先记为峰
    if (isPeak) {
      pivots.push({ index: i, type: 'peak', price: rows[i].high, date: rows[i].date });
    } else if (isValley) {
      pivots.push({ index: i, type: 'valley', price: rows[i].low, date: rows[i].date });
    }
  }

  // 相邻同类去重：峰留更高、谷留更低，保证峰谷严格交替
  const collapsed: Pivot[] = [];
  for (const p of pivots) {
    const last = collapsed[collapsed.length - 1];
    if (!last || last.type !== p.type) {
      collapsed.push(p);
      continue;
    }
    if (p.type === 'peak' ? p.price > last.price : p.price < last.price) {
      collapsed[collapsed.length - 1] = p;
    }
  }

  // 相邻峰谷连成段（a 时间在前，b 在后；a 为谷是主升、a 为峰是主跌）
  const moves: KeyMove[] = [];
  for (let i = 0; i + 1 < collapsed.length; i++) {
    const a = collapsed[i];
    const b = collapsed[i + 1];
    const changeRate = a.price === 0 ? 0 : ((b.price - a.price) / a.price) * 100;
    moves.push({
      key: `${a.date}~${b.date}`,
      start: a.date,
      end: b.date,
      startPrice: round2(a.price),
      endPrice: round2(b.price),
      changeRate: round2(changeRate),
    });
  }

  // 按 |涨跌幅| 降序取前 50%
  moves.sort((x, y) => Math.abs(y.changeRate) - Math.abs(x.changeRate));
  const keep = Math.max(1, Math.ceil(moves.length * KEEP_RATIO));
  return moves.slice(0, keep);
}

/** 把用户输入归一化为东财 secid，保证后续用东财接口拉 K 线不会 404 */
async function resolveSecid(query: string): Promise<{ secid: string; name: string; code: string }> {
  const q = query.trim();
  if (!q) {
    throw new Error('请输入股票名称、代码或 secid（如 贵州茅台 / 600519 / gzmt / 1.600519）');
  }
  if (/^[0-9]+\.[0-9]+$/.test(q)) {
    // 已是东财 secid：市场号.代码
    return { secid: q, name: '', code: q.split('.')[1] ?? q };
  }
  // ts_code（如 600519.SH）剥成代码走搜索；名称/代码/拼音也走搜索
  const tsCode = /^([0-9]{6})\.[A-Z]{2}$/i.exec(q);
  const keyword = tsCode ? tsCode[1] : q;
  const list = await searchSecurities(keyword);
  if (!list.length) {
    throw new Error(`未搜索到「${q}」对应的证券，请检查名称/代码后重试`);
  }
  const first = list[0];
  return { secid: first.id, name: first.name, code: first.code };
}

/** 获取某只股票的关键行情区间（入参归一化 + 拉日 K + 计算），不含 K 线明细 */
export async function getKeyMoves(query: string): Promise<KeyMoveList> {
  const { secid, name: searchName, code: searchCode } = await resolveSecid(query);

  // 用后复权计算涨跌幅：价格始终为正、反映累计收益，避免前复权因除权把早期价打成负值
  const { rows, summary } = await getKlines(secid, 'day', MAX_BARS, '2');
  const name = (typeof summary.name === 'string' && summary.name) || searchName || secid;
  const code = (typeof summary.code === 'string' && summary.code) || searchCode || secid;

  const items = computeKeyMoves(rows);
  if (!items.length) {
    throw new Error(`「${name}」日 K 数据不足以识别关键行情区间（有效峰谷少于 2 个）`);
  }

  return { security: { id: secid, code, name }, items };
}
