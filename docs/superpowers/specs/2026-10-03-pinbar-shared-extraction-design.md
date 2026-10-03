# Pinbar 计算下沉 shared，渲染层与 agent 共用同一份

日期：2026-10-03
状态：设计已确认，待用户复核后进入实现计划

## 一、背景与目标

### 现状

- pinbar（长影线反转形态）的算法与移动止损回测**只存在于渲染层** `src/renderer/src/components/Chart/pinbar.ts`（233 行），且与 `klinecharts` 的 `OverlayCreate` 强耦合：文件同时承担"形态识别 + 回测"和"转成 overlay 坐标"两件事。
- agent 侧（`src/main/agent/`）的 23 个 tool、4 个因子（`macd_cross` / `ma_cross` / `rsi_reversal` / `boll_breakout`）**完全没有 pinbar**；`resources/skills/`、`docs/` 里也搜不到相关字样（`src/main`、`resources`、`docs` 全库无匹配）。
- 因此图表上能看到 pinbar 信号，agent 却既调不到、也算不出与之口径一致的结果。

### 目标

1. 把 pinbar 的纯算法与回测抽到 `src/shared/src/lib/pinbar.ts`，**渲染层与 agent 共用同一份实现**，杜绝两套口径漂移。
2. 让 pinbar 成为 agent 的一个**因子**，可被 `compute_factor` / `analyze_factor` 直接使用，并被 `technical-signal` skill 的因子清单覆盖。

### 非目标（明确不做）

- 不新增独立 tool（如 `compute_pinbar`）——只做成因子。
- 不改渲染层的视觉与行为：矩形颜色、`extendData` 文本、显隐逻辑、`Chart.tsx` 全部保持原样。
- 不重构因子框架的类型体系（不引入字符串枚举参数）。
- 不做与本次目标无关的重构。

## 二、需求决策（brainstorm 结论）

| 议题 | 决策 |
| --- | --- |
| agent 侧形态 | 只做成 `pinbar` 因子；`compute_factor` 找形态、`analyze_factor` 出统计 |
| 止损档位怎么传 | **不暴露 `stopMode`**，因子固定 `aggressive`（与渲染层现状一致）；只把 `wickRatio`（影线占整根 K 线比例阈值，默认 2/3）做成可调数字参数 |
| 移动止损结果怎么传出来 | `FactorSignal` 增加通用 `meta` 字段；`analyze_factor` 按 `meta.result` 聚合出 `metaSummary` |

## 三、架构

### 3.1 模块边界

沿用仓库既有先例：`chanlun` 的纯算法在 `src/shared/src/lib/chanlun.ts`，`klinecharts` 转换留在渲染层 `src/renderer/src/components/Chart/overlays.ts`（该文件注释里已写明"pinbar 的计算与回测见 ./pinbar"）。pinbar 照此切分：

```
src/shared/src/lib/pinbar.ts            纯算法 + 回测 + 类型（零 klinecharts 依赖）
        ├──> src/renderer/src/components/Chart/pinbar.ts   仅 overlay 适配（保留原导出名）
        └──> src/main/agent/factors/index.ts               pinbar 因子适配（映射为 FactorSignal）
```

`@shared/*` 别名在 main / preload / renderer 三份配置里都已存在（`electron.vite.config.ts`、`tsconfig.node.json`、`tsconfig.web.json`），main 侧已有先例从 shared 引纯逻辑（如 `factors/index.ts` 引 `@shared/lib/macd`、`src/main/utils/createApiIpc.ts` 引 `@shared/lib/chanlun`），无需新增构建配置。

### 3.2 shared 模块接口

```ts
export type PinbarDirection = 'long' | 'short';
export type PinbarStopMode = 'aggressive' | 'conservative';
export type PinbarResultType = 'failed' | 'success' | 'in-progress';

/** 计算所需的最小 K 线字段：不需要 timestamp，记录用下标定位 */
export interface PinbarBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PinbarOptions {
  stopMode: PinbarStopMode;
  /** 影线占比阈值，默认 2/3 */
  wickRatio?: number;
}

export interface PinbarRecord {
  index: number;
  leftEyeIndex: number;
  direction: PinbarDirection;
  endIndex: number;
  profit: number;
  result: PinbarResultType;
  /** 结束时的止损位（详见 3.5 的语义说明） */
  stopPrice: number;
}

export function computePinbars(list: PinbarBar[], options: PinbarOptions): PinbarRecord[];

/** 盈亏比例百分比文本：0.23 -> "23%"，-0.15 -> "-15%" */
export function formatPercent(profit: number): string;
```

- 现有文件头那段"一、Pinbar 定义 / 二、有效性判断 / 三、回测与移动止损 / 四、回测区间分类"的说明注释**一并迁移**到 shared，算法本体逐行搬迁，语义不变。
- `formatPercent` 一并上移并导出：渲染层的矩形角标与 agent 的 `reason` 共用同一份措辞。
- 输入类型刻意用 `PinbarBar` 而非 `PriceAndVolumeItem`：渲染侧的 `PriceAndVolumeItem` 与 agent 侧的 `FactorBar` 都结构化兼容它，shared 不必依赖任何一侧的具体类型。

### 3.3 渲染层适配层

`src/renderer/src/components/Chart/pinbar.ts` 只保留：

- `PINBAR_RANGE_COLORS`（失败灰 / 成功蓝 / 进行中黄，值不变）
- `buildPinbarOverlays(list: PriceAndVolumeItem[], options: PinbarOptions, visible = true): OverlayCreate[]`

并重新导出 `PinbarStopMode` 等类型。**对外导出名与语义完全不变，因此 `Chart.tsx`（含 `PINBAR_STOP_MODE: PinbarStopMode = 'aggressive'` 一行）零改动。** overlay 的 `name`、`points`、`styles.color`、`extendData = formatPercent(record.profit)` 全部保持原样。

### 3.4 因子框架的最小扩展

`src/main/agent/factors/index.ts`：

1. `FactorBar` 增加 `open: number`。这是本次唯一的**接口破坏性变更**：pinbar 判形态必须用开盘价算实体，而当前 `FactorBar` 只有 `date/close/high/low`。构造点仅两处，都在 agent 内：
   - `src/main/agent/tools/compute-factor.ts` 的行映射
   - `src/main/agent/tools/analyze-factor.ts` 的行映射
   两处都补 `open: r.open`（东财 K 线行本就带 `open`）。
2. `FactorSignal` 增加可选 `meta`：

   ```ts
   export interface FactorSignal {
     date: string;
     type: 'buy' | 'sell';
     price: number;
     reason: string;
     /** 因子专属的结构化附注；analyze_factor 会按 meta.result 聚合 */
     meta?: Record<string, number | string>;
   }
   ```

   用通用的 `Record<string, number | string>`，框架层不出现任何 pinbar 专有类型。

### 3.5 pinbar 因子

```ts
FACTORS.pinbar = {
  name: 'pinbar',
  description: '长影线反转（pinbar）形态，含移动止损回测；注意结局字段是事后回测结果',
  params: [{ key: 'wickRatio', desc: '影线占整根 K 线比例阈值', default: 2 / 3 }],
  fn: pinbarFactor,
};
```

`pinbarFactor(bars, params)` 固定 `stopMode: 'aggressive'`，按 `wickRatio`（默认 2/3）调用 `computePinbars`，逐条记录映射为信号：

| 信号字段 | 取值 |
| --- | --- |
| `date` | `bars[record.index].date`（入场日 = pinbar 当日） |
| `type` | `direction === 'long' ? 'buy' : 'sell'` |
| `price` | `bars[record.index].close`（入场价 = pinbar 收盘价，与回测口径一致） |
| `reason` | 方向 + 结束止损位（`record.stopPrice`）+ 结局（成功/失败/进行中、盈亏、结束日） |
| `meta` | `{ direction, stopPrice, endDate: bars[record.endIndex].date, result, profit }` |

`reason` 与 `meta` 都带结局信息是刻意的：`compute_factor` 的返回要能让模型直接看到止损位与结局，而 `analyze_factor` 需要结构化字段才能可靠聚合。

**`PinbarRecord.stopPrice` 的语义（实现阶段核实并修订）：** 它是**结束时的止损位**，不是初始止损 s(0)。`runBacktest` 在退出时返回当时已被移动止损抬到的 `stop`（`result === 'in-progress'` 时则是最后一根 K 线时的止损位）。原文件里 `/** 初始止损价 s(0) */` 的注释是错的，搬迁时一并改正为如实的描述（纯注释修订，零行为变更）。因此 `reason` 一律表述为"结束止损位"，不得写成"初始止损价"；初始止损 s(0) 的计算规则仍见模块头部注释第三节，该节描述是对的。

pinbar 产出的信号仍只是普通 `buy` / `sell`（`type` 只有这两个取值），因此 `analyze_factor` 现有的 `evaluateSignals`（`factors/backtest.ts`）的 `holdBars` 事件回测**无需任何改动**即可套用；`meta` 只是并列的附加信息，不参与其计算。

**两条必须写进 `description` 与 skill 文档的语义约束：**

1. **结局是事后（forward-looking）信息**：`result` / `profit` / `endDate` 描述的是入场之后直到触发止损（或数据末尾）的结果，不是入场当时可知的信息。模型不得据此把历史信号解释成"当时就能预知会成功"，也不得把它当作可用于实盘的先验。
2. **末尾截断**：`computePinbars` 在遇到第一条"未触发止损（in-progress）"的记录后停止（因为其区间一直延伸到最后一根 K 线，后续信号必然与之重叠）。这条行为原样保留，因子信号因此在数据尾部可能被截断。

另修一处显示缺陷：`describeFactors()` 现在会把默认值直接打印出来，`2 / 3` 会渲染成 `wickRatio=0.6666666666666666`。改为对参数默认值做轻量格式化（整数照旧，非整数最多保留 4 位小数）。

### 3.6 analyze_factor 的 metaSummary

`src/main/agent/tools/analyze-factor.ts`：通用 `holdBars` 事件回测统计**保持不变**；当返回的信号中存在 `meta.result` 时，额外附一个通用命名的 `metaSummary`：

```ts
metaSummary: {
  resultCounts: { failed: number; success: number; 'in-progress': number };
  /** 仅统计 result !== 'in-progress' 的样本 */
  winRate: number | null;
  avgProfit: number | null;
}
```

命名刻意通用（`metaSummary` 而非 `pinbarSummary`），避免通用工具里长出因子特例；将来任何因子往 `meta` 里放 `result` / `profit` 都能自动获得这份统计。

## 四、文档

`resources/skills/technical-signal/SKILL.md` 的"可用因子"清单增加 `pinbar`，并写明：`wickRatio` 参数含义、以及"结局为事后回测结果、且数据尾部会截断"两条提示。

## 五、验证

仓库当前**没有任何测试文件，也没有 vitest 配置**（`package.json` 里有 vitest devDep 与 `test` 脚本，但无测试用例），本次改动没有现成回归网。验证手段：

1. `npm run typecheck`（node + web 两侧都要过）——跨层搬迁没搬坏的主要证据，同时覆盖 `FactorBar` 接口变更的全部构造点。
2. `npm run lint`。
3. 新增 `src/shared/src/lib/pinbar.test.ts`：用合成 K 线钉住搬迁前后的行为——aggressive 与 conservative 两档的止损位（`stopPrice`）、移动止损触发的那根 K 线、success/failed/in-progress 三种分类、`wickRatio` 阈值的作用、以及"首个 in-progress 即 break"的截断行为。所有期望值取自搬迁前实现的实测输出，搬迁后必须逐位一致。
   - 若该环境下 vitest 实际跑不起来（`test` 脚本走 `ELECTRON_RUN_AS_NODE=1 electron`），需在实现阶段确认并如实汇报，不得把"没跑"说成"通过"。
4. 人工核对渲染层 diff：应当只有 import 变化与代码搬出，没有行为改动。

## 六、风险

| 风险 | 缓解 |
| --- | --- |
| forward-looking 结局被模型误读为入场时已知 | factor description + skill 文档双处显式警告 |
| `FactorBar` 加 `open` 漏改构造点导致编译/运行错误 | typecheck 两侧兜底；已知构造点仅 compute-factor / analyze-factor |
| 渲染层视觉被无意改动 | 适配层只搬运不改写，`Chart.tsx` 零改动，diff 人工复核 |
| 两处口径再次漂移 | 算法只有一份（shared），两侧都只做映射 |
| 因子信号在尾部被截断被误解为"没有信号" | 在 description 与 skill 文档写明截断行为 |

## 七、实施顺序概要

细节交由实现计划展开（writing-plans）：

1. 新建 `src/shared/src/lib/pinbar.ts`，搬迁算法与注释、导出类型与 `formatPercent`。
2. 渲染层 `Chart/pinbar.ts` 改为 overlay 适配层，保持对外导出不变；`npm run typecheck:web`。
3. `FactorBar` 加 `open`、`FactorSignal` 加 `meta`；compute-factor / analyze-factor 补映射。
4. 实现并注册 `pinbar` 因子；修正 `describeFactors()` 的浮点显示。
5. `analyze_factor` 增加 `metaSummary`。
6. 更新 `technical-signal` skill 文档。
7. 新增 shared 层测试；跑 typecheck / lint / test 并汇报。
