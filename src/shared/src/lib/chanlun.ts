import {
  ChanlunK,
  Pivot,
  PivotDpData,
  PriceAndVolumeItem,
  Segment,
  Stroke,
  StrokeDpData,
} from '@shared/types/stock';

const getChanlunK = (origin: PriceAndVolumeItem[]) => {
  const items = origin.map<ChanlunK>((item) => ({
    high: item.high,
    low: item.low,
    timestamp: item.timestamp,
  }));
  let i = 0;
  let j = 1;
  while (j < items.length) {
    // 判断后一个的趋势
    if (items[j].low < items[i].low && items[j].high > items[j].high) {
      items[j].trend = 'up';
    }
    if (items[i].high >= items[j].high && items[i].low <= items[j].low) {
      if (items[i].trend === 'up') {
        items[i].low = Math.max(items[i].low, items[j].low);
      } else {
        items[i].high = Math.min(items[i].high, items[j].high);
      }
      items[j].enclosed = true;
      j++;
    } else if (items[j].high >= items[i].high && items[j].low <= items[i].low) {
      if (items[i].trend === 'up') {
        items[j].high = Math.min(items[i].high, items[j].high);
      } else {
        items[j].low = Math.max(items[i].low, items[j].low);
      }
      items[i].enclosed = true;
      // 被包含的向后传递趋势
      items[j].trend = items[i].trend;
      i = j;
      j++;
    } else {
      i = j;
      j++;
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

export const computeSegments = (strokes: Stroke[], direction: Stroke['type']) => {
  const segments: Segment[] = [];
  const features: Stroke[] = [];
  for (let i = 0; i < strokes.length; i++) {
    // 不同向的笔组成同向线段的特征序列
    if (strokes[i].type === direction) {
      continue;
    }
    if (!features.length) {
      features.push({ ...strokes[i] });
      continue;
    }
    const last = features[features.length - 1];
    const lastHigh = Math.max(last.start.price, last.end.price);
    const lastLow = Math.min(last.start.price, last.end.price);
    const currentHigh = Math.max(strokes[i].start.price, strokes[i].end.price);
    const currentLow = Math.min(strokes[i].start.price, strokes[i].end.price);
    // 前包含后
    if (lastHigh > currentHigh && lastLow < currentLow) {
      last.end.price = strokes[i].end.price;
      continue;
    }
    // 后包含前
    if (lastHigh < currentHigh && lastLow > currentLow) {
      const lastPrice = last.end.price;
      features[features.length - 1] = {
        ...strokes[i],
        end: {
          ...strokes[i].end,
          price: lastPrice,
        },
      };
      continue;
    }
    features.push({ ...strokes[i] });
  }

  const checkIsSameDirection = (i: number, j: number) => {
    if (i >= features.length || j >= features.length) {
      return false;
    }
    if (i >= j) {
      return false;
    }
    if (direction === 'up') {
      let flag = true;
      for (let p = i; p < j; p++) {
        // 向上的线段的特征序列向下，判断后者的终点是否更高
        if (!(features[p + 1].end.price > features[p].end.price)) {
          flag = false;
          break;
        }
      }
      return flag;
    }
    let flag = true;
    for (let p = i; p < j; p++) {
      // 向下的线段的特征序列向上，判断后者的终点是否更低
      if (!(features[p + 1].end.price < features[p].end.price)) {
        flag = false;
        break;
      }
    }
    return flag;
  };

  let i = 0;
  let j = i + 1;
  let k = j + 1;
  let l = k + 1;
  while (i < features.length && j < features.length && k < features.length) {
    // i, j 不能组成当前 direction 的线段
    if (!checkIsSameDirection(i, j)) {
      i++;
      j = i + 1;
      k = j + 1;
      continue;
    }
    // i, k 能组成线段，再往后延长
    if (checkIsSameDirection(i, k)) {
      k++;
      continue;
    }
    // i, k 不能组成线段，即 k 小于 j，还需要判断 k 后续是否能形成新的 direction 方向的线段
    if (checkIsSameDirection(k, l)) {
      l++;
      continue;
    }
  }

  return segments;
};

export const computeStrokesWithDp = (origin: PriceAndVolumeItem[]) => {
  const items = getChanlunK(origin);
  const dp: StrokeDpData[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].fractal) {
      dp.push({
        count: 0,
        target: i,
        dif: 0,
      });
    }
  }
  for (let i = 0; i < dp.length; i++) {
    // 剪枝：往前枚举 20 个分形应该就够了
    for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
      // 只能连接不同类型的分形
      if (items[dp[j].target].fractal === items[dp[i].target].fractal) {
        continue;
      }
      // 两个分形直接至少包含 5 条 K 线
      if (dp[i].target - dp[j].target < 5) {
        continue;
      }
      // 底分型只能连接更高的顶分形
      if (
        items[dp[i].target].fractal === 'bottom' &&
        items[dp[i].target].low > items[dp[j].target].high
      ) {
        continue;
      }
      // 顶分型只能连接更低的底分形
      if (
        items[dp[i].target].fractal === 'top' &&
        items[dp[i].target].high < items[dp[j].target].low
      ) {
        continue;
      }
      // 按照最多『笔』的连接来划分
      if (dp[j].count + 1 > dp[i].count) {
        dp[i].count = dp[j].count + 1;
        dp[i].prev = j;
        dp[i].dif = computeDif(items[dp[i].target], items[dp[j].target]);
      }
      // 如果笔数一致，则按照最大距离的连接来划分
      const dif = dp[j].dif + computeDif(items[dp[i].target], items[dp[j].target]);
      if (dp[j].count + 1 === dp[i].count && dif > dp[i].dif) {
        dp[i].prev = j;
        dp[i].dif = dif;
      }
    }
  }
  const max = {
    index: 0,
    value: 0,
  };
  for (let i = 0; i < dp.length; i++) {
    if (dp[i].count > max.value) {
      max.value = dp[i].count;
      max.index = i;
    }
  }
  const strokes: Stroke[] = [];
  let i: number | undefined = max.index;
  while (i) {
    const prevDpIndex = dp[i].prev;
    const prev = prevDpIndex ? dp[prevDpIndex].target : undefined;
    const curr = dp[i].target;
    if (curr && prev) {
      const isUp = items[curr].fractal === 'top';
      strokes.push({
        type: isUp ? 'up' : 'down',
        start: {
          timestamp: items[prev].timestamp,
          price: isUp ? items[prev].low : items[prev].high,
        },
        end: {
          timestamp: items[curr].timestamp,
          price: isUp ? items[curr].high : items[curr].low,
        },
      });
    }
    i = dp[i].prev;
  }
  return strokes;
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
    };

    // 枚举可行的作为中枢的笔
    for (let j = i - 1; j >= 0; j--) {
      p.low = strokes[j].type === 'down' ? Math.max(p.low, strokes[j].end.price) : p.low;
      p.high = strokes[j].type === 'up' ? Math.min(p.high, strokes[j].end.price) : p.high;

      // 已经不重叠了
      if (p.low >= p.high) {
        break;
      }

      // 如果笔方向不同，或者笔数小于 5，则不能形成中枢
      if (strokes[i].type !== strokes[j].type || i - j < 4) {
        continue;
      }

      // 如果开始笔不是从中枢反向突破而来，不能形成中枢
      // if (
      //   (strokes[i].type === 'up' && strokes[j].start.price > p.low) ||
      //   (strokes[i].type === 'down' && strokes[j].start.price < p.high)
      // ) {
      //   continue;
      // }

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
    });
  }
  return res;
};
