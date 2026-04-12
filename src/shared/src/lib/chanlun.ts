import {
  ChanlunK,
  ExtendedPivot,
  Pivot,
  PivotDpData,
  PriceAndVolumeItem,
  Segment,
  Stroke,
} from '@shared/types/stock';

const getChanlunK = (origin: PriceAndVolumeItem[]) => {
  const items = origin.map<ChanlunK>((item) => ({
    high: item.high,
    low: item.low,
    timestamp: item.timestamp,
  }));

  for (let i = 0, j = 1; j < items.length; ) {
    // 先判断后一个 K 的趋势
    // 向上
    if (items[i].low < items[j].low && items[i].high < items[j].high) {
      items[j].trend = 'up';
    }
    // 向下
    if (items[i].high > items[j].high && items[i].low > items[j].low) {
      items[j].trend = 'down';
    }

    // 如果 i 包含 j
    if (items[i].low <= items[j].low && items[i].high >= items[j].high) {
      // 根据趋势处理 K 线
      if (items[i].trend === 'up') {
        items[i].low = Math.max(items[i].low, items[j].low);
      } else {
        items[i].high = Math.min(items[i].high, items[j].high);
      }
      items[j].enclosed = true;
      j++;
      // 如果 j 包含 i
    } else if (items[j].high >= items[i].high && items[j].low <= items[i].low) {
      if (items[i].trend === 'up') {
        items[j].low = Math.max(items[i].low, items[j].low);
      } else {
        items[j].high = Math.min(items[i].high, items[j].high);
      }
      i = j;
      j = i + 1;
      // 都不包含
    } else {
      i = j;
      j = i + 1;
    }
  }

  // 标记顶底分形
  for (let i = 0; i < items.length; i++) {
    if (items[i].enclosed) {
      continue;
    }
    // 找到相邻的不被包含的 K 线
    let prev = i - 1;
    let next = i + 1;
    for (; prev >= 0; prev--) {
      if (!items[prev].enclosed) {
        break;
      }
    }
    for (; next < items.length; next++) {
      if (!items[next].enclosed) {
        break;
      }
    }
    if (prev >= 0 && next < items.length) {
      // 顶分型
      if (items[i].high > items[prev].high && items[i].high > items[next].high) {
        items[i].fractal = 'top';
      }
      // 底分型
      if (items[i].low < items[prev].low && items[i].low < items[next].low) {
        items[i].fractal = 'bottom';
      }
    }
  }
  return items;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const computeDif = (a: ChanlunK, b: ChanlunK) => {
  if (a.fractal === 'top') {
    return a.high - b.low;
  }
  return b.high - a.low;
};

export const computeStrokeSimply = (origin: PriceAndVolumeItem[]) => {
  const strokes: Stroke[] = [];
  const items = getChanlunK(origin);

  const genStroke = (i: number, j: number): Stroke => ({
    type: items[j].fractal === 'top' ? 'up' : 'down',
    start: {
      timestamp: items[i].timestamp,
      price: items[j].fractal === 'top' ? items[i].low : items[i].high,
    },
    end: {
      timestamp: items[j].timestamp,
      price: items[j].fractal === 'top' ? items[j].high : items[j].low,
    },
  });

  const checkIsStroke = (i: number, j: number) => {
    // 如果 i 是 0，第一笔随意
    if (!i && items[j].fractal) {
      return true;
    }
    if (i >= items.length || j >= items.length) {
      return false;
    }
    if (!items[i].fractal || !items[j].fractal) {
      return false;
    }
    let count = 0;
    for (let k = Math.min(i, j); k <= Math.max(i, j); k++) {
      // 过滤被包含 K 线
      if (!items[k].enclosed) {
        count++;
      }
    }
    if (count < 4) {
      return false;
    }
    if (
      items[i].fractal === 'top' &&
      items[j].fractal === 'bottom' &&
      items[i].high > items[j].low
    ) {
      return true;
    }
    if (
      items[i].fractal === 'bottom' &&
      items[j].fractal === 'top' &&
      items[i].low < items[j].high
    ) {
      return true;
    }
    return false;
  };

  let i = 0;
  let j = i + 1;
  let k = j + 1;
  while (i < items.length && j < items.length && k < items.length) {
    // 找到下一个和 i 不同的分形，且距离需要大于 4
    if (!checkIsStroke(i, j)) {
      j++;
      k = j + 1;
      continue;
    }

    // 如果能组成新的一笔，保存前一笔，向后移动光标
    if (checkIsStroke(j, k)) {
      strokes.push(genStroke(i, j));
      i = j;
      j = k;
      k = j + 1;
      continue;
    }
    // 不能组成，但 k 的分形和 j 相同，且是一个更大的趋势，延长该笔
    if (items[j].fractal === 'top' && items[k].fractal === 'top' && items[k].high > items[j].high) {
      j = k;
      k = j + 1;
      continue;
    }
    if (
      items[j].fractal === 'bottom' &&
      items[k].fractal === 'bottom' &&
      items[k].low < items[j].low
    ) {
      j = k;
      k = j + 1;
      continue;
    }

    k++;
  }

  if (checkIsStroke(i, j)) {
    strokes.push(genStroke(i, j));
  }

  return strokes;
};

export const computeSegmentsSimply = (strokes: Stroke[]) => {
  const res: Segment[] = [];
  // 预处理数据
  const pre: Array<{ index: number; type: 'top' | 'bottom' }> = [];

  // 第一个位置无所谓
  pre.push({
    index: 0,
    type: 'top',
  });
  for (let i = 1; i < strokes.length - 1; i++) {
    // 向上的笔就能同时处理顶和底
    if (strokes[i].type === 'up') {
      if (
        strokes[i].end.price > strokes[i - 1].start.price &&
        i + 2 < strokes.length &&
        strokes[i].end.price > strokes[i + 2].end.price
      ) {
        pre.push({
          index: i,
          type: 'top',
        });
      }
      if (
        strokes[i].start.price < strokes[i + 1].end.price &&
        i - 2 > 0 &&
        strokes[i].start.price < strokes[i - 2].start.price
      ) {
        pre.push({
          index: i,
          type: 'bottom',
        });
      }
    }
  }

  const checkIsSegment = (i: number, j: number) => {
    // 至少得是三笔
    if (pre[i].type === 'bottom' && pre[j].index - pre[i].index + 1 < 3) {
      return false;
    }
    if (pre[i].type === 'top' && pre[j].index - pre[i].index + 1 < 5) {
      return false;
    }
    // 如果 i 是 0，第一笔随意
    if (!i) {
      return true;
    }
    if (i >= pre.length || j >= pre.length) {
      return false;
    }
    if (
      i < j &&
      pre[i].type === 'top' &&
      pre[j].type === 'bottom' &&
      strokes[pre[i].index].end.price > strokes[pre[j].index].start.price
    ) {
      return true;
    }
    if (
      i < j &&
      pre[i].type === 'bottom' &&
      pre[j].type === 'top' &&
      strokes[pre[i].index].start.price < strokes[pre[j].index].end.price
    ) {
      return true;
    }
    return false;
  };

  const genSegment = (i: number, j: number): Segment => {
    return {
      type: pre[i].type === 'bottom' ? 'up' : 'down',
      start: pre[i].type === 'bottom' ? strokes[pre[i].index].start : strokes[pre[i].index].end,
      end: pre[j].type === 'bottom' ? strokes[pre[j].index].start : strokes[pre[j].index].end,
    };
  };

  let i = 0;
  let j = i + 1;
  let k = j + 1;
  while (i < pre.length && j < pre.length && k < pre.length) {
    // 找到下一个和 i 不同的笔
    if (!checkIsSegment(i, j)) {
      j++;
      k = j + 1;
      continue;
    }

    // 如果能组成新的线段，保存前一笔，向后移动光标
    if (checkIsSegment(j, k)) {
      res.push(genSegment(i, j));
      i = j;
      j = k;
      k = j + 1;
      continue;
    }
    // 不能组成，但 k 的分形和 j 相同，且是一个更大的趋势，延长该线段
    if (
      pre[j].type === 'top' &&
      pre[k].type === 'top' &&
      strokes[pre[k].index].end.price > strokes[pre[j].index].end.price
    ) {
      j = k;
      k = j + 1;
      continue;
    }
    if (
      pre[j].type === 'bottom' &&
      pre[k].type === 'bottom' &&
      strokes[pre[k].index].start.price < strokes[pre[j].index].start.price
    ) {
      j = k;
      k = j + 1;
      continue;
    }
    k++;
  }

  if (checkIsSegment(i, j)) {
    res.push(genSegment(i, j));
  }

  return res;
};

export const computePivotWithDp = (strokes: Stroke[]) => {
  const dp: PivotDpData[] = [];
  for (let i = 0; i < strokes.length; i++) {
    // 以当前笔为结束笔，往前枚举中枢
    const p: PivotDpData = {
      type: strokes[i].type,
      count: 0,
      end: i,
      start: i,
      // 下降中枢最小值不能大于结束笔的最低价（即中枢突破）
      low: strokes[i].type === 'down' ? strokes[i].end.price : Number.MIN_SAFE_INTEGER,
      // 上升中枢最大值不能小于结束笔的最高价（即中枢突破）
      high: strokes[i].type === 'up' ? strokes[i].end.price : Number.MAX_SAFE_INTEGER,
      min: Number.MAX_SAFE_INTEGER,
      max: Number.MIN_SAFE_INTEGER,
    };

    // 枚举可行的作为中枢的笔
    for (let j = i - 1; j >= 0; j--) {
      p.low = strokes[j].type === 'down' ? Math.max(p.low, strokes[j].end.price) : p.low;
      p.high = strokes[j].type === 'up' ? Math.min(p.high, strokes[j].end.price) : p.high;
      p.min = Math.min(p.min, strokes[j].start.price);
      p.max = Math.max(p.max, strokes[j].start.price);

      // 已经不重叠了
      if (p.low >= p.high) {
        break;
      }

      // 如果笔方向不同，或者笔数小于 5，则不能形成中枢
      if (strokes[i].type !== strokes[j].type || i - j < 4) {
        continue;
      }

      // 如果开始笔不是从中枢反向突破而来，不能形成中枢
      if (
        (strokes[i].type === 'up' && strokes[j].start.price > p.low) ||
        (strokes[i].type === 'down' && strokes[j].start.price < p.high)
      ) {
        continue;
      }

      // 不能算前后两笔
      const strokeCount = i - j - 1;
      const newPivot = {
        ...p,
        start: j,
        count: strokeCount,
      };

      // 枚举前一个中枢，使中枢占的笔数最多
      for (let k = dp.length - 1; k >= 0; k--) {
        if (dp[k].end <= newPivot.start && dp[k].count + strokeCount > newPivot.count) {
          newPivot.count = dp[k].count + strokeCount;
          newPivot.prev = k;
          // break;
        }
      }

      // 放入一个可行解
      dp.push(newPivot);
    }
  }

  const res: Pivot[] = [];
  const max = {
    index: 0,
    count: 0,
  };
  for (let i = 0; i < dp.length; i++) {
    if (dp[i].count > max.count) {
      max.count = dp[i].count;
      max.index = i;
    }
  }
  for (let i: number | undefined = max.index; i; i = dp[i].prev) {
    res.push({
      type: dp[i].type,
      start: strokes[dp[i].start].end.timestamp,
      end: strokes[dp[i].end].start.timestamp,
      low: dp[i].low,
      high: dp[i].high,
      min: dp[i].min,
      max: dp[i].max,
    });
  }
  return res;
};

const checkPivotHasCollapse = <T extends { min: number; max: number }>(a: T, b: T) => {
  if (a.min < b.min) {
    return b.min < a.max;
  }
  return b.max > a.min;
};

export const computeExtendedPivot = (pivots: Pivot[]) => {
  const res: ExtendedPivot[] = [];
  let i = 0;
  let j = 1;
  let newExtendedPivot: ExtendedPivot | undefined = undefined;
  while (j < pivots.length) {
    if (!newExtendedPivot) {
      if (pivots[i].type === pivots[j].type && checkPivotHasCollapse(pivots[i], pivots[j])) {
        newExtendedPivot = {
          type: pivots[i].type,
          min: Math.min(pivots[i].min, pivots[j].min),
          max: Math.max(pivots[i].max, pivots[j].max),
          start: pivots[i].start,
          end: pivots[j].end,
        };
        j++;
        continue;
      }
      i++;
      j++;
      continue;
    }
    if (
      newExtendedPivot.type === pivots[j].type &&
      checkPivotHasCollapse(newExtendedPivot, pivots[j])
    ) {
      newExtendedPivot = {
        type: newExtendedPivot.type,
        min: Math.min(newExtendedPivot.min, pivots[j].min),
        max: Math.max(newExtendedPivot.max, pivots[j].max),
        start: newExtendedPivot.start,
        end: pivots[j].end,
      };
      j++;
      continue;
    }
    res.push(newExtendedPivot);
    newExtendedPivot = undefined;
    i = j + 1;
    j = i + 1;
  }
  if (newExtendedPivot) {
    res.push(newExtendedPivot);
  }
  return res;
};
