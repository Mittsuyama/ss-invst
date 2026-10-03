# Pinbar 计算下沉 shared 并接入 agent 因子 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> （注：本仓库 `.agents/skills/` 下**没有** `subagent-driven-development`，只有 `executing-plans`；若要逐任务派发子 agent，由主执行者手工派发，不要去找那个 skill。）

**Goal:** 把 pinbar 的形态识别与移动止损回测从渲染层抽到 `src/shared/src/lib/pinbar.ts`，让渲染层 overlay 与 agent 因子共用同一份实现，并让 agent 能通过 `compute_factor` / `analyze_factor` 使用 pinbar。

**Architecture:** 纯算法下沉 shared（零 `klinecharts` 依赖），两侧各留一个薄适配层：渲染层把 `PinbarRecord` 转成矩形 overlay，agent 把 `PinbarRecord` 映射成 `FactorSignal`。这与仓库既有先例完全一致——`chanlun` 的算法在 `src/shared/src/lib/chanlun.ts`，`klinecharts` 转换在 `src/renderer/src/components/Chart/overlays.ts`。

**Tech Stack:** TypeScript + Electron（electron-vite）、React 19、klinecharts 10（仅渲染层）、vitest 3.2（已有 devDep，但此前无任何测试与配置）、pi-agent-core（tool 框架）。

**Spec:** `docs/superpowers/specs/2026-10-03-pinbar-shared-extraction-design.md`

## Global Constraints

- **渲染层视觉与行为不得变化**：`src/renderer/src/components/Chart/Chart.tsx` 必须**零改动**（本计划任何任务都不含该文件）。
- **不暴露 `stopMode`**：pinbar 因子固定 `aggressive`；只暴露 `wickRatio`（默认 `2 / 3`）。
- **不新增任何依赖**，不新增独立 tool（pinbar 只做成因子）。
- **不重构无关代码**，不新建与任务无关的文件。
- **提交纪律**：工作区已存在与本任务无关的改动（`.npmrc`、`electron.vite.config.ts`、`src/renderer/src/components/Detail.tsx`、`src/renderer/src/hooks/useTencentTrends.ts`、`src/renderer/src/pages/Choice.tsx`、`src/renderer/src/pages/ChoiceOverview.tsx`、`src/renderer/src/pages/Option.tsx`、`yarn.lock`，以及一个已 staged 的 `package-lock.json` 删除）。**每次提交只能用 `git add <明确路径>`，严禁 `git add -A` / `git add .` / `git commit -a`**；提交后用 `git show --stat HEAD` 确认只含本任务文件。
- **两条必须在文案里出现的语义约束**（因子 `description` 与 skill 文档）：① `result` / `profit` / `endDate` 是入场之后的事后（forward-looking）回测结果，不是入场时可知的信息；② 数据尾部出现未触发止损的信号后，更晚的 pinbar 不再输出（区间重叠被截断）。
- **`PinbarRecord.stopPrice` 是「结束时的止损位」**，不是初始止损 s(0)（实测：A 组 `stopPrice = 108.75` 而 pinbar 最低价是 95；D 组进行中为 `117.296875` 而同为 95）。原注释 `/** 初始止损价 s(0) */` 是错的，迁移时**只改注释、不改计算**；`reason` 文案一律写"结束止损位"，不得写成"初始止损价"。初始止损 s(0) 的计算规则本身没问题，仍见模块头部注释第三节。
- **验证命令**（在本仓库根目录运行，均实测可用）：
  - 全部测试：`npm test`
  - 单文件测试：`npm test -- src/shared/src/lib/pinbar.test.ts`
  - 类型检查：`npm run typecheck`（= `typecheck:node` + `typecheck:web`）
  - Lint：`npm run lint`
- **黄金值来源**：本计划中所有 pinbar 期望数值，均由**搬迁前的渲染层实现**（`src/renderer/src/components/Chart/pinbar.ts`）实测采集，用作搬迁前后的逐位一致性证据。不要"顺手修正"任何数值。

---

### Task 1: 把 pinbar 算法与回测下沉到 shared（特征化测试先行）

**Files:**
- Create: `src/shared/src/lib/pinbar.ts`
- Test: `src/shared/src/lib/pinbar.test.ts`

**Interfaces:**
- Consumes: 无（该文件不 import 任何东西，含输入类型都自定义，从而对 main / renderer 都无依赖）
- Produces:
  - `type PinbarDirection = 'long' | 'short'`
  - `type PinbarStopMode = 'aggressive' | 'conservative'`
  - `type PinbarResultType = 'failed' | 'success' | 'in-progress'`
  - `interface PinbarBar { open: number; high: number; low: number; close: number }`
  - `interface PinbarOptions { stopMode: PinbarStopMode; wickRatio?: number }`
  - `interface PinbarRecord { index: number; leftEyeIndex: number; direction: PinbarDirection; endIndex: number; profit: number; result: PinbarResultType; stopPrice: number }`
  - `function computePinbars(list: PinbarBar[], options: PinbarOptions): PinbarRecord[]`
  - `function formatPercent(profit: number): string`

- [ ] **Step 1: 先写失败的特征化测试**

创建 `src/shared/src/lib/pinbar.test.ts`（内容如下，逐字使用；这些期望值全部来自搬迁前实现的实测输出）：

```ts
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
const C: PinbarBar[] = [
  bar(100, 104, 99, 100),
  bar(100, 110, 100, 101),
  bar(101, 111, 100, 110),
];

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
```

- [ ] **Step 2: 跑测试，确认它失败**

Run: `npm test -- src/shared/src/lib/pinbar.test.ts`
Expected: FAIL —— 报 `Failed to load url ./pinbar` / `Does the file exist?`（模块还不存在；此时**不应**出现任何断言失败。）

- [ ] **Step 3: 实现 `src/shared/src/lib/pinbar.ts`**

从 `src/renderer/src/components/Chart/pinbar.ts` **逐行搬迁**算法与文件头说明注释，只做两处调整：输入类型 `PriceAndVolumeItem` → `PinbarBar`，并新增 `export` `formatPercent`。内容如下：

```ts
/**
 * ============================================================================
 * Pinbar（长影线反转形态）计算与历史回测
 * ============================================================================
 *
 * ## 一、Pinbar 定义
 * - 空头 pinbar（看跌，做空）：最高价与「开/收盘孰高」之差 > 整根 K 线长度
 *   （最高价 - 最低价）的 2/3，即上影线超过整根 K 线的 2/3。
 * - 多头 pinbar（看涨，做多）：「开/收盘孰低」与最低价之差 > 整根 K 线长度的 2/3，
 *   即下影线超过整根 K 线的 2/3。
 *
 * ## 二、有效性判断（依赖左眼 = 左侧相邻 K 线）
 * 以下条件同时满足才视为「有效 pinbar」：
 * 1. 显眼：左眼总长度（最高 - 最低）< pinbar 总长度（最高 - 最低）。
 * 2. 拒绝跳空：左眼包含 pinbar 实体：左眼最高 > pinbar「开/收盘孰高」，
 *    且左眼最低 < pinbar「开/收盘孰低」。
 *
 * ## 三、历史回测与移动止损
 * 找到有效 pinbar 后，从 pinbar 收盘价入场，计算到达结束位置时的盈亏比例：
 * - 初始止损 s(0) 是 t0（pinbar 当天）的某个价格，分为两档（函数参数，可调）：
 *     - 激进（aggressive）：pinbar 极值（多头 = 最低价，空头 = 最高价）。
 *     - 保守（conservative）：影线的 61.8% 处，即距极值占整条影线的 38.2%。
 * - 第 i 天：若当天触发止损线则结束；否则止损位
 *       s(i) = s(i-1) * 1/2 + p(i) * 1/2，
 *     其中 p(i) 做空取最高价、做多取最低价。
 * - 盈亏比例：多头 (结束价 - 收盘价) / 收盘价，空头 (收盘价 - 结束价) / 收盘价。
 *
 * ## 四、回测区间分类
 * - 失败（failed）：触发止损且收益 < 0。
 * - 成功（success）：触发止损且收益 > 0。
 * - 进行中（in-progress）：未触发止损，但 K 线已到最后一根。
 *
 * 本模块只做「算法 + 回测」，不含任何图表库依赖：
 * 渲染层把它转成 overlay（见 renderer 的 Chart/pinbar.ts），
 * agent 把它映射成因子信号（见 main/agent/factors/pinbar.ts）。
 * ============================================================================
 */

export type PinbarDirection = 'long' | 'short';
export type PinbarStopMode = 'aggressive' | 'conservative';
export type PinbarResultType = 'failed' | 'success' | 'in-progress';

/** 计算所需的最小 K 线字段；记录用下标定位，因此不需要时间戳 */
export interface PinbarBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PinbarOptions {
  /** 止损档位：激进 / 保守 */
  stopMode: PinbarStopMode;
  /** 影线占比阈值，默认 2/3 */
  wickRatio?: number;
}

export interface PinbarRecord {
  /** pinbar 在 list 中的索引 */
  index: number;
  /** 左眼在 list 中的索引（index - 1） */
  leftEyeIndex: number;
  direction: PinbarDirection;
  /** 结束位置在 list 中的索引（触发止损当天 / 最后一根） */
  endIndex: number;
  /** 盈亏比例（进行中为 0） */
  profit: number;
  result: PinbarResultType;
  /**
   * 结束时的止损位：触发止损当天的止损位；进行中则为最后一根 K 线时的止损位。
   * 注意这**不是**初始止损 s(0)（原代码注释误写为「初始止损价」，搬迁时已改正）。
   */
  stopPrice: number;
}

const DEFAULT_WICK_RATIO = 2 / 3;

function detectDirection(item: PinbarBar, wickRatio: number): PinbarDirection | null {
  const range = item.high - item.low;
  if (range <= 0) {
    return null;
  }
  const bodyHigh = Math.max(item.open, item.close);
  const bodyLow = Math.min(item.open, item.close);
  const threshold = range * wickRatio;
  if (item.high - bodyHigh > threshold) {
    return 'short';
  }
  if (bodyLow - item.low > threshold) {
    return 'long';
  }
  return null;
}

function isValidPinbar(pinbar: PinbarBar, leftEye: PinbarBar): boolean {
  // 1. 显眼：左眼总长度 < pinbar 总长度
  if (leftEye.high - leftEye.low >= pinbar.high - pinbar.low) {
    return false;
  }
  // 2. 拒绝跳空：左眼包含 pinbar 实体
  const bodyHigh = Math.max(pinbar.open, pinbar.close);
  const bodyLow = Math.min(pinbar.open, pinbar.close);
  return leftEye.high > bodyHigh && leftEye.low < bodyLow;
}

function initialStopPrice(
  pinbar: PinbarBar,
  direction: PinbarDirection,
  stopMode: PinbarStopMode,
): number {
  if (stopMode === 'aggressive') {
    return direction === 'long' ? pinbar.low : pinbar.high;
  }
  // 保守：影线 61.8% 处，即距极值占整条影线的 38.2%
  const bodyHigh = Math.max(pinbar.open, pinbar.close);
  const bodyLow = Math.min(pinbar.open, pinbar.close);
  const shadow = direction === 'long' ? bodyLow - pinbar.low : pinbar.high - bodyHigh;
  return direction === 'long' ? pinbar.low + shadow * 0.382 : pinbar.high - shadow * 0.382;
}

function runBacktest(
  list: PinbarBar[],
  pinbarIndex: number,
  direction: PinbarDirection,
  stopMode: PinbarStopMode,
): Pick<PinbarRecord, 'endIndex' | 'profit' | 'result' | 'stopPrice'> {
  const pinbar = list[pinbarIndex];
  const entry = pinbar.close;
  let stop = initialStopPrice(pinbar, direction, stopMode);

  for (let i = pinbarIndex + 1; i < list.length; i++) {
    const bar = list[i];
    if (direction === 'long') {
      if (bar.low <= stop) {
        const profit = (stop - entry) / entry;
        return {
          endIndex: i,
          profit,
          result: profit < 0 ? 'failed' : 'success',
          stopPrice: stop,
        };
      }
      stop = stop * (1 / 2) + bar.low * (1 / 2);
    } else {
      if (bar.high >= stop) {
        const profit = (entry - stop) / entry;
        return {
          endIndex: i,
          profit,
          result: profit < 0 ? 'failed' : 'success',
          stopPrice: stop,
        };
      }
      stop = stop * (1 / 2) + bar.high * (1 / 2);
    }
  }

  return {
    endIndex: list.length - 1,
    profit: 0,
    result: 'in-progress',
    stopPrice: stop,
  };
}

/** 找到所有有效 pinbar，并对其做移动止损回测。 */
export function computePinbars(list: PinbarBar[], options: PinbarOptions): PinbarRecord[] {
  const { stopMode } = options;
  const wickRatio = options.wickRatio ?? DEFAULT_WICK_RATIO;
  const records: PinbarRecord[] = [];

  for (let i = 1; i < list.length; i++) {
    const pinbar = list[i];
    const leftEye = list[i - 1];
    const direction = detectDirection(pinbar, wickRatio);
    if (!direction) {
      continue;
    }
    if (!isValidPinbar(pinbar, leftEye)) {
      continue;
    }

    const backtest = runBacktest(list, i, direction, stopMode);
    records.push({
      index: i,
      leftEyeIndex: i - 1,
      direction,
      ...backtest,
    });

    // 已遇到「进行中」（未触发止损）的有效 pinbar，其区间一直延伸到最后一根 K 线，
    // 后续 pinbar 都会与其重叠，因此不再生成新的区域
    if (backtest.result === 'in-progress') {
      break;
    }
  }

  return records;
}

/** 将盈亏比例格式化为百分比文本，例如 0.23 -> "23%"、-0.15 -> "-15%"。 */
export function formatPercent(profit: number): string {
  return `${(profit * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
```

注意：`DEFAULT_WICK_RATIO` 保持为文件私有常量（渲染层不再需要它，`PinbarOptions.wickRatio` 的默认值语义由 `computePinbars` 承担）。

- [ ] **Step 4: 跑测试，确认通过**

Run: `npm test -- src/shared/src/lib/pinbar.test.ts`
Expected: PASS —— `Test Files 1 passed`，`Tests 10 passed`。

- [ ] **Step 5: 类型检查**

Run: `npm run typecheck`
Expected: 通过（此时渲染层还保有自己的副本，两处并存不冲突）。

- [ ] **Step 6: 提交**

```bash
git add src/shared/src/lib/pinbar.ts src/shared/src/lib/pinbar.test.ts
git commit -m "refactor: pinbar 算法与回测下沉到 shared/lib"
git show --stat HEAD
```

---

### Task 2: 渲染层改为 overlay 适配层

**Files:**
- Modify: `src/renderer/src/components/Chart/pinbar.ts`（整体替换为适配层）

**Interfaces:**
- Consumes: Task 1 的 `computePinbars` / `formatPercent` / `PinbarOptions` / `PinbarResultType`（自 `@shared/lib/pinbar`）
- Produces（**必须保持与现在完全同名同签名**，否则 `Chart.tsx:17` 会被迫修改）：
  - `function buildPinbarOverlays(list: PriceAndVolumeItem[], options: PinbarOptions, visible?: boolean): OverlayCreate[]`
  - 重新导出的类型：`PinbarDirection` / `PinbarStopMode` / `PinbarResultType` / `PinbarOptions`
  - 该文件是 `Chart.tsx` 唯一的 pinbar 导入来源（已核实 `import { buildPinbarOverlays, PinbarStopMode } from './pinbar'` 是仅有的引用处）

- [ ] **Step 1: 把该文件整体替换为适配层**

`src/renderer/src/components/Chart/pinbar.ts` 替换为以下内容（算法已搬走，这里只剩 overlay 转换）：

```ts
/**
 * Pinbar 回测区间的 klinecharts overlay 适配层。
 *
 * 形态识别与移动止损回测在 @shared/lib/pinbar（与 agent 因子共用同一份实现），
 * 本文件只负责把 PinbarRecord 转成图表矩形。
 */

import { OverlayCreate } from 'klinecharts';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { computePinbars, formatPercent, PinbarOptions, PinbarResultType } from '@shared/lib/pinbar';

export type {
  PinbarDirection,
  PinbarOptions,
  PinbarResultType,
  PinbarStopMode,
} from '@shared/lib/pinbar';

/** 区间矩形颜色：失败 = 灰、成功 = 蓝、进行中 = 黄（浅色底由 figure 派生） */
const PINBAR_RANGE_COLORS: Record<PinbarResultType, string> = {
  failed: '#8c8c8c',
  success: '#2196f3',
  'in-progress': '#e6b800',
};

/** 构建 pinbar 回测区间矩形 overlay：从 pinbar 左侧边起，到止损 K 线结束。 */
export function buildPinbarOverlays(
  list: PriceAndVolumeItem[],
  options: PinbarOptions,
  visible = true,
): OverlayCreate[] {
  return computePinbars(list, options).map((record): OverlayCreate => {
    const pinbar = list[record.index];
    const end = list[record.endIndex];
    const isLong = record.direction === 'long';
    // 做多：从 pinbar 最低点到止损 K 线最高点；做空相反（pinbar 最高点到止损 K 线最低点）
    const top = isLong ? end.high : pinbar.high;
    const bottom = isLong ? pinbar.low : end.low;
    return {
      visible,
      name: 'pinbarRange',
      paneId: 'candle_pane',
      lock: true,
      points: [
        { timestamp: pinbar.timestamp, value: top },
        { timestamp: end.timestamp, value: bottom },
      ],
      styles: {
        color: PINBAR_RANGE_COLORS[record.result],
      },
      // 盈亏比例文本，展示在矩形右下角
      extendData: formatPercent(record.profit),
    };
  });
}
```

- [ ] **Step 2: 类型检查（web 侧）**

Run: `npm run typecheck:web`
Expected: PASS。若报 `PinbarStopMode` 之类的导出问题，说明重新导出的类型名与 `Chart.tsx` 的用法不一致，照 `Chart.tsx:17,21` 的实际用法修正**适配层的导出**，不要去改 `Chart.tsx`。

- [ ] **Step 3: Lint 该文件**

Run: `npx eslint src/renderer/src/components/Chart/pinbar.ts`
Expected: 无 error。

- [ ] **Step 4: 确认 `Chart.tsx` 未被改动**

Run: `git diff --name-only 7dcf9de -- src/renderer/src/components/Chart/`
Expected: 只列出 `src/renderer/src/components/Chart/pinbar.ts`（**不得**出现 `Chart.tsx`）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/components/Chart/pinbar.ts
git commit -m "refactor: 渲染层 pinbar 只保留 overlay 适配，算法复用 shared"
git show --stat HEAD
```

---

### Task 3: FactorBar 增加 `open`，FactorSignal 增加 `meta`

**Files:**
- Modify: `src/main/agent/factors/index.ts:6-20`（两个接口）
- Modify: `src/main/agent/tools/compute-factor.ts:38-43`（行映射）
- Modify: `src/main/agent/tools/analyze-factor.ts:35-40`（行映射）

**Interfaces:**
- Consumes: 无新依赖
- Produces:
  - `interface FactorBar { date: string; open: number; close: number; high: number; low: number }`
  - `interface FactorSignal { date: string; type: 'buy' | 'sell'; price: number; reason: string; meta?: Record<string, number | string> }`

- [ ] **Step 1: 先改接口（制造预期的编译失败）**

把 `src/main/agent/factors/index.ts` 里的两个接口改成：

```ts
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
```

- [ ] **Step 2: 跑类型检查，确认它按预期失败**

Run: `npm run typecheck:node`
Expected: FAIL —— 报两个 `FactorBar[]` 赋值缺 `open` 属性，位置应恰好是 `src/main/agent/tools/compute-factor.ts` 与 `src/main/agent/tools/analyze-factor.ts`。**这是本次改动完整性的证据**：若还有其他文件报错，说明还有未发现的构造点，需一并补上。

- [ ] **Step 3: 补两处行映射**

`src/main/agent/tools/compute-factor.ts` 与 `src/main/agent/tools/analyze-factor.ts` 中的 `bars` 映射都改成：

```ts
      const bars: FactorBar[] = rows.map((r) => ({
        date: r.date,
        open: r.open,
        close: r.close,
        high: r.high,
        low: r.low,
      }));
```

（东财 K 线行本身带 `open`，见 `src/main/agent/data/eastmoney.ts:120`，无需改数据层。）

- [ ] **Step 4: 类型检查通过**

Run: `npm run typecheck:node`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/main/agent/factors/index.ts src/main/agent/tools/compute-factor.ts src/main/agent/tools/analyze-factor.ts
git commit -m "feat: 因子框架补充 open 字段与 meta 附注"
git show --stat HEAD
```

---

### Task 4: pinbar 因子（含 vitest 配置）

**Files:**
- Create: `vitest.config.ts`
- Create: `src/main/agent/factors/pinbar.ts`
- Create: `src/main/agent/factors/pinbar.test.ts`
- Modify: `src/main/agent/factors/index.ts`（注册因子 + 修 `describeFactors` 的浮点显示）

**Interfaces:**
- Consumes: Task 1 的 `computePinbars` / `formatPercent` / `PinbarResultType`（自 `@shared/lib/pinbar`）、Task 3 的 `FactorBar` / `FactorSignal`
- Produces:
  - `function pinbarFactor(bars: FactorBar[], params: Record<string, number>): FactorSignal[]`
  - `const PINBAR_WICK_RATIO_KEY = 'wickRatio'`、`const PINBAR_DEFAULT_WICK_RATIO = 2 / 3`
  - `FACTORS.pinbar`（`{ name, description, params, fn }`）
  - `signal.meta` 形如 `{ direction: 'long' | 'short'; stopPrice: number; endDate: string; result: PinbarResultType; profit: number }`

**为什么要新建 `vitest.config.ts`（已实测的硬约束）：** 仓库此前没有任何 vitest/vite 配置，vitest **不会**解析 tsconfig 的 `@shared` 别名；实测在测试里 import `src/main/agent/factors/index.ts` 会直接报 `Cannot find package '@shared/lib/macd'`。而 `factors/index.ts` 正是本任务要改的注册点，所以必须先补配置。

- [ ] **Step 1: 新建 `vitest.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared/src'),
      '@renderer': resolve('src/renderer/src'),
      '@': resolve('src/renderer/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

Run: `npm test`
Expected: PASS（Task 1 的 11 个用例仍全绿，说明配置没有破坏既有测试）。

- [ ] **Step 2: 先写失败的因子测试**

创建 `src/main/agent/factors/pinbar.test.ts`：

```ts
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
```

- [ ] **Step 3: 跑测试，确认它失败**

Run: `npm test -- src/main/agent/factors/pinbar.test.ts`
Expected: FAIL —— 报 `Cannot find module './pinbar'`（因子实现还没写；**不应**出现断言失败）。

- [ ] **Step 4: 实现 `src/main/agent/factors/pinbar.ts`**

```ts
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
```

- [ ] **Step 5: 跑测试，确认只剩注册相关的失败**

Run: `npm test -- src/main/agent/factors/pinbar.test.ts`
Expected: 前 3 个用例 PASS；后 2 个用例 FAIL（`FACTORS.pinbar` 为 `undefined`、`describeFactors()` 不含 `pinbar`）。

- [ ] **Step 6: 注册因子并修 `describeFactors` 的浮点显示**

在 `src/main/agent/factors/index.ts` 顶部加入导入：

```ts
import { PINBAR_DEFAULT_WICK_RATIO, PINBAR_WICK_RATIO_KEY, pinbarFactor } from './pinbar';
```

在 `FACTORS` 对象里追加（放在 `boll_breakout` 之后）：

```ts
  pinbar: {
    name: 'pinbar',
    description:
      '长影线反转形态（pinbar）：下影线超长看多、上影线超长看空，并按移动止损规则给出历史回测结局。注意 result/profit/endDate 是入场之后的事后（forward-looking）回测结果，不是入场时可知的信息，请勿解读为当时即可预知；数据尾部一旦出现未触发止损的信号，更晚的 pinbar 不再输出（区间重叠）。',
    params: [
      { key: PINBAR_WICK_RATIO_KEY, desc: '影线占整根 K 线比例阈值', default: PINBAR_DEFAULT_WICK_RATIO },
    ],
    fn: pinbarFactor,
  },
```

并把 `describeFactors()` 里的参数默认值打印改为可读格式（修掉 `0.6666666666666666`）：

```ts
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
```

- [ ] **Step 7: 跑测试与类型检查**

Run: `npm test -- src/main/agent/factors/pinbar.test.ts`
Expected: PASS —— 5 个用例全绿。

Run: `npm run typecheck:node`
Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add vitest.config.ts src/main/agent/factors/pinbar.ts src/main/agent/factors/pinbar.test.ts src/main/agent/factors/index.ts
git commit -m "feat: 新增 pinbar 因子，复用 shared 的形态与移动止损回测"
git show --stat HEAD
```

---

### Task 5: analyze_factor 输出 metaSummary

**Files:**
- Create: `src/main/agent/factors/meta-summary.ts`
- Create: `src/main/agent/factors/meta-summary.test.ts`
- Modify: `src/main/agent/tools/analyze-factor.ts`

**Interfaces:**
- Consumes: Task 3 的 `FactorSignal`（`meta?: Record<string, number | string>`）
- Produces:
  - `interface MetaSummary { resultCounts: Record<string, number>; winRate: number | null; avgProfit: number | null }`
  - `function summarizeMeta(signals: FactorSignal[]): MetaSummary | undefined`

**设计约束：** 统计逻辑放在纯函数里（`meta-summary.ts`），`analyze-factor.ts` 只负责接线——这样既能被单测覆盖，也避免通用工具里出现 `factor === 'pinbar'` 之类的因子特例。命名保持通用（`metaSummary`），将来任何往 `meta.result` / `meta.profit` 里放值的因子都自动获得这份统计。

- [ ] **Step 1: 先写失败的测试**

创建 `src/main/agent/factors/meta-summary.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试，确认它失败**

Run: `npm test -- src/main/agent/factors/meta-summary.test.ts`
Expected: FAIL —— `Cannot find module './meta-summary'`。

- [ ] **Step 3: 实现 `src/main/agent/factors/meta-summary.ts`**

```ts
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
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `npm test -- src/main/agent/factors/meta-summary.test.ts`
Expected: PASS —— 3 个用例全绿。

- [ ] **Step 5: 接进 `analyze_factor`**

在 `src/main/agent/tools/analyze-factor.ts` 顶部加导入：

```ts
import { summarizeMeta } from '../factors/meta-summary';
```

把结尾的返回改为（保留原有 `stats` / `trades` 结构，只在有 meta 汇总时多附一块）：

```ts
      const { stats, trades } = evaluateSignals(bars, signals, args.holdBars ?? 20);
      const metaSummary = summarizeMeta(signals);
      return ok(
        { factor: args.factor, ...stats, ...(metaSummary ? { metaSummary } : {}) },
        { factor: args.factor, stats, metaSummary, trades },
        120000,
      );
```

- [ ] **Step 6: 类型检查 + 全量测试**

Run: `npm run typecheck:node`
Expected: PASS。

Run: `npm test`
Expected: PASS —— 三个测试文件共 18 个用例全绿（Task 1 的 10 个 + Task 4 的 5 个 + Task 5 的 3 个）。

- [ ] **Step 7: 提交**

```bash
git add src/main/agent/factors/meta-summary.ts src/main/agent/factors/meta-summary.test.ts src/main/agent/tools/analyze-factor.ts
git commit -m "feat: analyze_factor 汇总信号 meta 的回测结局"
git show --stat HEAD
```

---

### Task 6: 文档同步与全量验证

**Files:**
- Modify: `resources/skills/technical-signal/SKILL.md`
- Modify: `.agents/skills/investment-skill-authoring/SKILL.md:95`

**Interfaces:**
- Consumes: Task 4 的 `FACTORS.pinbar`、Task 5 的 `metaSummary`
- Produces: 无代码接口（仅文档）

**说明：** `docs/history/2026-08-22-投资agent搭建与运行时skill系统.md:66` 也列了因子清单，但那是**历史记录**，按仓库惯例不得修改。

- [ ] **Step 1: 更新 `technical-signal` skill**

`resources/skills/technical-signal/SKILL.md` 的"可用因子"清单（当前第 20-25 行）在 `boll_breakout` 之后追加一行：

```markdown
- pinbar：长影线反转形态（下影线超长看多、上影线超长看空），按移动止损规则做历史回测（参数 wickRatio，默认 2/3）
```

并在"## 注意"小节追加一条：

```markdown
- pinbar 信号的「结局」（成功/失败/进行中、盈亏、结束日）是**入场之后的事后回测结果**，不是入场时可知的信息，不得据此声称当时可预知；数据尾部出现未触发止损的信号后，更晚的 pinbar 不再输出。`analyze_factor` 会额外给出 metaSummary（结局分布、胜率、平均盈亏）。
```

- [ ] **Step 2: 更新 `investment-skill-authoring` skill 的内置因子清单**

`.agents/skills/investment-skill-authoring/SKILL.md` 第 95 行改为：

```markdown
内置因子：`macd_cross`(fast/slow/signal)、`ma_cross`(short/long)、`rsi_reversal`(period/oversold/overbought)、`boll_breakout`(period/mult)、`pinbar`(wickRatio)。
```

- [ ] **Step 3: 全量验证**

```bash
npm run typecheck
npm run lint
npm test
```

Expected: 三条命令全部通过；`npm test` 报 3 个测试文件、18 个用例全绿。若有失败，**如实报告失败内容**，不要跳过或改写测试来凑绿。

- [ ] **Step 4: 确认渲染层核心文件未被改动**

```bash
git diff --stat 7dcf9de -- src/renderer/src/components/Chart/Chart.tsx
git status --short
```

Expected: 第一条**无输出**（`Chart.tsx` 零改动）；第二条只应列出本计划涉及的文件，那些与本任务无关的既有改动（`.npmrc`、`electron.vite.config.ts`、`Detail.tsx`、`useTencentTrends.ts`、`Choice.tsx`、`ChoiceOverview.tsx`、`Option.tsx`、`yarn.lock`、`package-lock.json`）应保持原样未提交。

- [ ] **Step 5: 提交**

```bash
git add resources/skills/technical-signal/SKILL.md .agents/skills/investment-skill-authoring/SKILL.md
git commit -m "docs: 因子清单补充 pinbar 与事后回测提示"
git show --stat HEAD
```

- [ ] **Step 6: 人工验证（可选，需用户配合）**

自动化测试覆盖不到渲染层 overlay 的视觉效果。若需确认图表行为未变，由用户运行 `npm run dev`，在详情页切换到 pinbar 视图，确认回测区间矩形仍正常绘制、颜色与角标百分比正常。此步**不是**本计划的完成前提，但不得声称"已视觉验证"。

---

## 完成标准

1. `src/shared/src/lib/pinbar.ts` 是 pinbar 形态与回测的**唯一**实现；渲染层与 agent 都只是薄适配。
2. `npm run typecheck`、`npm run lint`、`npm test`（18 用例）三条命令全绿。
3. `Chart.tsx` 零改动，且 `git diff 7dcf9de -- src/renderer/src/components/Chart/` 只含 `pinbar.ts`。
4. `FACTORS.pinbar` 注册成功，`describeFactors()` 中显示 `wickRatio=0.6667`，`description` 含事后回测提示。
5. `analyze_factor` 对 pinbar 信号额外返回 `metaSummary`，对普通因子不返回。
6. 两处文档（`technical-signal`、`investment-skill-authoring`）因子清单已同步；历史文档未改。
