---
name: agent-tool-authoring
description: 指导如何给这个投资 agent 新增一个工具（tool）：AgentTool 结构、TypeBox 参数 schema、数据层分离、数据源标注、注册、UI 事件、错误处理与确定性计算原则。当用户需要：新增/扩展 agent 的某个工具、给 agent 加取数/计算/文件/网络/脚本能力、封装一个确定性函数成 tool、或想了解 tool 的写法与注册流程时使用。
---

# Agent 工具（tool）编写指南

## 概述

本指南教你如何给运行在 Electron 桌面端的投资 agent 新增一个 **tool**——agent 可以直接调用的函数，用代码定义、启动时注册进 `pi-agent-core` 的 `Agent`。

> **先厘清几个概念**（命名很像，别混）：
> - **tool**：代码里的一个可调用函数（本指南讲的），位于 `src/main/agent/tools/`。
> - **运行时 skill**（`resources/skills/`）：磁盘上的 markdown 流程包，靠 `use_skill` 注入 system prompt、按流程调 tool。写运行时 skill 看 `investment-skill-authoring`。
> - **开发期 skill**（`.agents/skills/`）：给写这个 app 的编码 agent 用，**本文件就属于这一层**。

tool 是能力的最小单元：`search_stock`、`get_quote`、`tushare_query`、`save_file`、`compute_factor` 等都是 tool。

## 1. 目录与分层

```
src/main/agent/
  tools/            # 每个 tool 一个文件：createXxxTool(Type, ...deps) → AgentTool
    index.ts        # createTools(ctx)：把所有 tool 组装成数组，注册入口
    common.ts       # ok() / toText() / PiType
  data/             # 数据/网络层：eastmoney.ts / tushare.ts / download.ts / files.ts …
  factors/          # 确定性计算：因子信号 / 回测
  session/          # 会话目录读写（session-store / session-runtime）
```

**职责边界**：

- `tools/` 只做「定义 schema + 校验 + 调下层 + 拼返回值」的**薄封装**，不放业务逻辑。
- 网络请求、取数、字段翻译放 `data/`（如 `eastmoney.ts`、`tushare.ts`）。
- 能「跑一遍判断对错」的确定性计算放 `factors/` 或 `data/`，**不要交给 LLM 手算**。

## 2. AgentTool 结构

来自 `@earendil-works/pi-agent-core` 的 `AgentTool`，五要素 + execute：

```ts
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { ok, type PiType } from './common';

export function createGetQuoteTool(Type: PiType): AgentTool {
  return {
    name: 'get_quote',                    // 唯一 id，snake_case（LLM 与事件都用它）
    label: '行情快照',                     // 中文显示名，进 UI 的工具进度
    description: '[eastmoney] ……',        // LLM 决定何时调用的依据，开头标数据源，见 §3
    parameters: Type.Object({ /* … */ }), // TypeBox schema，见 §4
    // executionMode: 'sequential',       // 可选：覆盖全局并行策略（默认走 agent 的 parallel）
    execute: async (_id, params) => {
      // 完整签名是 (toolCallId, params, signal, onUpdate)，本仓库习惯只取前两个
      const { secid } = params as { secid: string };
      const quote = await getQuote(secid);
      return ok({ code: quote.code, name: quote.name }, quote);
    },
  };
}
```

要点：

- `name` 全局唯一、`snake_case`（`get_quote` / `compute_factor` / `tushare_query`）。
- `label` 是 UI 显示名；`agent.ts` 里 `toolLabels[tool.name] = tool.label`，`tool_start`/`tool_end` 事件带它。
- `execute` 返回 `ok(details, data, maxLen?)`（见 §5）；失败 `throw`（见 §8）。
- 工厂函数签名为 `createXxxTool(Type, ...额外依赖)`：`Type` 由注册处传入（见 §7），额外依赖如 `emit`、`applySkill`。

## 3. description 怎么写

`description` 是 LLM 决定「什么时候该调这个 tool、传什么参数」的**唯一依据**。按「数据源标识 + 是什么 + 关键参数 + 何时用 + 输入格式约定」写。

**数据源标识（取数类 tool 必加）**：凡是有取数来源的 tool，description 开头必须用方括号标注数据源，让 agent 快速判断来源与限流风险：

- `[tushare]` —— 数据来自 Tushare；
- `[eastmoney]` —— 数据来自东方财富（可能限流、需人机校验）；
- `[复合：…]` —— 混合型，如「eastmoney K线 + 本地计算」，点明组合，别只写 `[复合]`；
- 纯本地/工具类（`save_file`、`read_file`、`run_script`、`update_todo`、`decide`、`list_skills`、`use_skill` 等）无取数来源，不标注。

示例：

```
'[eastmoney] 获取个股实时行情与估值快照：最新价、涨跌幅、市盈率TTM、市净率、总市值、换手率、上市日期、所属行业等。'
```

```
'[tushare] 调用 Tushare 通用接口获取补充数据。常用 api_name：daily（日线）、daily_basic（每日指标）……'
```

```
'[复合：eastmoney K线 + 本地计算] 拉取 K 线并用指定因子计算买卖点信号……'
```

> 判断数据源的依据是「tool 最终调用的取数函数」：调 `data/eastmoney.ts` 里的函数标 `[eastmoney]`，调 `data/tushare.ts` 里的函数标 `[tushare]`，两者都调或「取数 + 本地计算」标 `[复合：…]`。像 `secidToTsCode` 这种纯代码转换不算取数，不要因此标成复合。

如果参数有特殊格式（如 `secid` 要「市场号.代码」），写进 description 或参数的 `description` 字段里，帮 LLM 少踩坑。

## 4. 参数 schema（TypeBox）

`parameters` 用 TypeBox 的 `Type.*` 构建，`Type` 命名空间类型是 `PiType`（`common.ts` 里定义，值在注册时传入）。常用构造器：

```ts
parameters: Type.Object({
  // 必填字符串，带参数说明
  secid: Type.String({ description: '股票 id，格式「市场号.代码」，如 1.600519' }),

  // 可选字符串
  fields: Type.Optional(Type.String({ description: '需要的字段，逗号分隔' })),

  // 整数 + 约束
  limit: Type.Optional(Type.Integer({ default: 250, minimum: 30, maximum: 1000 })),

  // 枚举：Type.Union + Type.Literal
  period: Type.Optional(
    Type.Union([Type.Literal('day'), Type.Literal('week'), Type.Literal('month')]),
  ),

  // 自由对象（键名不固定）
  params: Type.Record(Type.String(), Type.Unknown(), { description: '接口参数对象' }),

  // 数值参数表（键名不固定、值都是 number）
  params: Type.Optional(
    Type.Record(Type.String(), Type.Number(), { description: '因子参数，如 {short:5, long:20}' }),
  ),
}),
```

execute 里按 schema 断言参数类型：

```ts
const p = params as { api_name: string; params?: Record<string, unknown>; fields?: string };
```

## 5. common.ts 辅助

```ts
export function ok(details: unknown, data: unknown, maxLen?: number) {
  return {
    content: [{ type: 'text', text: toText(data, maxLen) }],
    details,
  };
}
```

- `ok(摘要, 数据, maxLen?)`：**第一个参数**放进 `details`（结构化、短，给 LLM 快速看）；**第二个参数**被 `JSON.stringify` 后放进 `content[0].text`（超长自动截断，截断上限默认 60000，可传 `maxLen` 放宽，如大表用 `200000`）。
- `details` 只放几个关键字段（`{ count }`、`{ code, name }`、`{ path }`），别把整坨数据塞进去。
- `toText(data, maxLen)`：序列化 + 截断 + 附截断提示。

## 6. 数据层分离

tool 不直接发 HTTP，调 `data/` 里的函数。举例：

```ts
// tools/get-quote.ts —— 薄封装
import { getQuote } from '../data/eastmoney';
// data/eastmoney.ts —— 真正的网络/取数逻辑
import { axiosGet } from '../../utils/axios';
```

约定：

- 东方财富取数 → `data/eastmoney.ts`；Tushare → `data/tushare.ts`；下载 → `data/download.ts`；读文件/PDF 提文字 → `data/files.ts`；指标计算 → `data/indicators.ts`；中文字段名映射 → `data/field-labels.ts`。
- 需要「每次提问时由渲染进程注入」的运行时配置（东方财富 Cookie、Tushare Token），统一放进 `data/eastmoney.ts` 的 `runtime` 对象（`runtime.cookie` / `runtime.tushareToken`），别在 tool 里直接读全局。
- 会话相关读写在 `session/`（`session-store.ts` / `session-runtime.ts`）：`sessionRuntime.workspacePath` / `sessionId` / `currentSkill`，`saveSessionFile` / `writeUploadBytes` / `getSessionDir`。

## 7. 注册

一个 tool 写完，要在 `tools/index.ts` 里登记：

1. import 工厂：`import { createGetQuoteTool } from './get-quote';`
2. 在 `createTools(ctx)` 返回数组里加一行，把 `Type`（和需要的依赖）传进去：

```ts
export async function createTools(ctx: AgentToolContext): Promise<AgentTool[]> {
  const { ai } = await loadPi();
  const Type = ai.Type;               // Type 从这里懒加载，不要顶层 import

  return [
    // …既有工具…
    createGetQuoteTool(Type),
    createSaveFileTool(Type, ctx.emit),        // 需要发 UI 事件的，传 emit
    createUseSkillTool(Type, ctx.applySkill),  // 需要切 skill 的，传 applySkill
  ];
}
```

`AgentToolContext` 目前两个字段：

```ts
export interface AgentToolContext {
  emit: (event: AgentEvent) => void;               // 推事件给渲染进程
  applySkill: (name: string | undefined) => string | undefined; // 选定/清空当前 skill
}
```

> `Type` 必须通过 `loadPi()` 拿 `ai.Type` 后传入，不要在 tool 文件里顶层 import（pi-ai 是懒加载）。

## 8. UI 事件（可选）

如果 tool 产出了要在界面上可见的东西（保存的文件、待办、决策），用 `ctx.emit` 推事件。`AgentEvent`（`@shared/types/agent`）里有：

- `file_saved`（`{ file: { name, path, dir } }`）—— `save_file` / `download_url` 保存文件后推，渲染成消息底部卡片；
- `todo_update`（`{ items }`）—— 待办整体替换；
- `decision_update`（`{ entry }`）—— 追加决策日志；
- `skill_applied`（`{ name, description? }`）—— 切换 skill 时推。

纯取数/计算类 tool（`get_quote`、`compute_factor` 等）**不需要** emit；只有产生持久化/UI 副作用的才发。emit 前先判会话存在，例如：

```ts
if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
  throw new Error('当前没有打开的会话，无法保存文件');
}
```

## 9. 错误处理

**失败就 `throw new Error(...)`，不要返回错误字符串。** agent 会捕获异常、把该 tool 标为 `isError: true` 并展示给用户。例子：

```ts
const def = FACTORS[args.factor];
if (!def) throw new Error(`未知因子 ${args.factor}，可用：${Object.keys(FACTORS).join(', ')}`);
```

throw 出来的 message 会进 LLM 的下一轮上下文，所以**写清楚「什么错了 + 怎么改」**（给可用的取值、给正确的格式提示），帮 LLM 自动 refine。

## 10. 确定性计算原则

- 凡是「跑一遍能判断对错」的：指标计算、因子信号、回测、数据清洗、HTML 渲染、PDF 后处理——写成确定性的 TS/Node 函数（放 `factors/` 或 `data/`），**别让 LLM 用嘴算**。
- 因子类走 `factors/`：`FactorDef = { name, description, params, fn }`，注册进 `FACTORS`，用 `describeFactors()` 生成给 LLM 的因子清单（见 `compute-factor.ts` / `analyze-factor.ts`）。

## 11. 最小示例骨架

```ts
// src/main/agent/tools/get-foo.ts
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { getFoo } from '../data/eastmoney';   // 业务逻辑放 data 层
import { ok, type PiType } from './common';

export function createGetFooTool(Type: PiType): AgentTool {
  return {
    name: 'get_foo',
    label: '获取 Foo',
    description: '[eastmoney] 获取某只股票的 Foo 数据（说明是什么 + 何时用）。',
    parameters: Type.Object({
      secid: Type.String({ description: '股票 id，格式「市场号.代码」，如 1.600519' }),
      limit: Type.Optional(Type.Integer({ default: 100, minimum: 1, maximum: 500 })),
    }),
    execute: async (_id, params) => {
      const { secid, limit } = params as { secid: string; limit?: number };
      const data = await getFoo(secid, limit ?? 100);
      return ok({ count: data.length }, data);
    },
  };
}
```

```ts
// src/main/agent/tools/index.ts —— 注册
import { createGetFooTool } from './get-foo';
// 在 createTools 返回数组里加：
createGetFooTool(Type),
```

## 12. 检查清单

1. `name` 唯一、`snake_case`；`label` 中文、一眼可读。
2. `description` 开头标数据源标识（`[tushare]` / `[eastmoney]` / `[复合：…]`；纯本地/工具类不标），并写清「做什么 + 关键参数 + 何时用 + 输入格式约定」。
3. `parameters` 用 TypeBox 表达类型/约束/默认值；execute 里按 schema 断言。
4. 网络/取数/计算逻辑下沉 `data/` 或 `factors/`，tool 保持薄封装。
5. 返回值走 `ok(摘要, 数据, maxLen?)`；大输出记得放宽 `maxLen`。
6. 失败 `throw new Error`，message 写「错在哪 + 怎么改」。
7. 有 UI 副作用（保存文件/待办/决策）才 `ctx.emit`，且先判会话存在。
8. 在 `tools/index.ts` 里 import + 加入数组；`Type` 从参数传入、不顶层 import。
9. 确定性计算交给代码，不交给 LLM。
10. 修改后 `npm run typecheck`（含 `typecheck:node`）通过。
