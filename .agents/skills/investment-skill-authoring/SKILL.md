---
name: investment-skill-authoring
description: 指导如何编写/新增一个「运行时投资 skill」（resources/skills/ 下的技能包），利用本投资 agent 的工具、plan-decision-verify 循环和文件管理办法。当用户需要：编写一个新的投资分析 skill、扩展 agent 能力、把某套投资流程封装成 skill、设计 skill 的脚本/模板/校验、或想了解 agent 有哪些工具可用时使用。
---

# 投资 Skill 编写指南

## 概述

本 skill 教你如何为一个运行在 Electron 桌面端的投资分析 agent 编写「**运行时 skill**」——磁盘上的技能包，让 agent 按既定流程调用工具完成复杂投资任务（取数、下载/读取 PDF、因子回测、生成报告等）。

> **先分清两套 skill**（命名很像，别混）：
> - **开发期 skill**（`.agents/skills/`）：给写这个 app 的编码 agent 用，**本文件就属于这一层**。
> - **运行时 skill**（`resources/skills/`）：给 Electron 里的投资 agent 用，**本指南讲的是这一层**。

## 1. 运行时 skill 目录结构

一个 skill = 一个目录，目录名即 skill 名（`name`）：

```
resources/skills/<skill-name>/
  SKILL.md          # 入口：frontmatter + 阶段大纲（保持短）
  references/       # 按需 read_file 的知识：字段清单、检查表、方法说明
  templates/        # report.md / report.html 等模板
  scripts/          # 可执行 Node 脚本（.mjs/.cjs），通过 run_script 执行、不读源码
  verify.js         # 确定性验收脚本（预留，当前未强制执行）
```

**关键原则：渐进披露**——只有 `SKILL.md` 会被常驻进上下文（`use_skill` 把它注入 system prompt 的独立段）；`references/`、`templates/` 按需读；`scripts/` 只执行不读源码。所以 `SKILL.md` 要短，细节下沉到 `references/`。

## 2. SKILL.md 格式

```yaml
---
name: value-investing              # 必填，与目录名一致
description: 长线价值投资分析……     # 必填，含触发词，用于自动路由
params:                            # 可选，仅文档化（不做表单）
  - key: stock_code
    desc: 股票代码，如 600519
verify: verify.js                  # 可选，预留
---
# 流程（阶段大纲）
```

- `description` 写成带触发词的句式（「当用户需要……时使用」），决定 agent 能否自动命中该 skill。
- 正文写**阶段大纲**（分几步、每步调什么工具），不要写长知识——长知识放 `references/`，让 agent 用 `read_file` 按需读。

## 3. 工具清单（19 个）

编写 skill 时，只允许调用以下工具。分五组：

### 编排 / 循环

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `update_todo` | `todos: [{title, status}]`，status ∈ pending/in_progress/done | 整体重写会话 `todo.md`，标记当前步 |
| `read_todo` | 无 | 读回 `todo.md`（压缩后恢复进度） |
| `decide` | `decision`, `reason?` | 追加一条决策到 `task.md` 决策日志 |

### skill 路由

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `list_skills` | 无 | 列出可用运行时 skill |
| `use_skill` | `name` | 选定当前 skill（注入其 SKILL.md） |

### 文件 / 脚本

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `read_file` | `path`（绝对 / skill 相对 / session 相对） | 读 PDF（自动提文字）/txt/md/json/csv 等 |
| `save_file` | `filename`, `content`, `dir?`（files/output/intermediate） | 保存文本到会话目录，默认 files |
| `run_script` | `script`, `args?`, `timeoutSec?` | 用主进程 Node 执行脚本（cwd=会话目录），返回 exitCode/stdout/stderr |
| `download_url` | `url` | 下载文件到会话 `uploads/` |

### 数据（东方财富，字段已中文化）

| 工具 | 关键参数 | 用途 |
| --- | --- | --- |
| `search_stock` | `keyword`（名称/代码/拼音） | 确定 `secid`（格式「市场号.代码」，如 1.600519） |
| `get_quote` | `secid` | 行情 + 估值快照（PE-TTM/PB/市值/行业…） |
| `get_klines` | `secid`, `period?`(day/week/month), `limit?` | K 线 + MA/MACD/KDJ/RSI/BOLL + 信号摘要 |
| `get_financial_statements` | `secid`, `years?` | 近 N 年三大报表 + 领先指标（ROE/毛利率/周转天数…） |
| `get_business` | `secid` | 主营构成（产品/行业收入占比、毛利率） |
| `get_dividends` | `secid`, `years?` | 分红送股历史 |
| `tushare_query` | `api_name`, `params`, `fields?` | Tushare 通用补充数据（daily_basic/income/balancesheet/cashflow/fina_indicator/dividend 等） |

### 因子计算 / 回测（确定性代码，非 LLM 计算）

| 工具 | 关键参数 | 用途 |
| --- | --- | --- |
| `compute_factor` | `secid`, `factor`, `period?`, `limit?`, `params?` | 拉 K 线算买卖信号 |
| `analyze_factor` | `secid`, `factor`, `period?`, `limit?`, `params?`, `holdBars?` | 信号回测：胜率/赔率/平均盈亏/交易明细 |

内置因子：`macd_cross`(fast/slow/signal)、`ma_cross`(short/long)、`rsi_reversal`(period/oversold/overbought)、`boll_breakout`(period/mult)。

### 网络

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `web_search` | `query` | DuckDuckGo 网页搜索（无需 key，best-effort） |

## 4. plan-decision-verify 循环

agent 的 system prompt 里常驻一行循环骨架：

```
复杂多步任务循环：decide 记决策 → 执行 → 校验结果 → update_todo 推进 / 失败 refine 重试
```

落地到 skill 的约定（写入 SKILL.md 的「执行循环」段）：

- **`task.md`** = 目标 + 决策日志：意图不可变，关键选择用 `decide` 追加（「为什么这么选」），压缩后可恢复脉络。
- **`todo.md`** = 步骤光标：用 `update_todo` 整体重写 `- [ ]/[~]/[x]`，标当前步/剩余步。
- 每步执行后**校验结果**：接口为空/脚本非零退出/数据缺失 → 用 `read_todo` 恢复进度后重试或换方案（refine）；不要「自我宣布完成」而不校验。

编写 skill 时，务必在正文写清「每步的校验标准」和「失败时的回退动作」。

## 5. 文件管理办法（input / intermediate / output）

会话目录下的四类文件：

| 目录 | 语义 | 写入方式 |
| --- | --- | --- |
| `uploads/` | 用户上传 + `download_url` 下载 | 自动，工具写 |
| `files/` | 通用生成 | `save_file` 默认 `dir` |
| `intermediate/` | skill 中间产物 | `save_file(dir='intermediate')` |
| `output/` | skill 最终报告 | `save_file(dir='output')` |

- **最终报告统一进 `output/`**，中间数据进 `intermediate/`，别都堆 `files/`。
- `read_file` 的三路径解析顺序：绝对路径 > skill 相对路径（如 `references/估值方法.md`）> session 相对路径（如 `output/2025-report.md`、`task.md`）。
- `run_script` 的 `cwd` 是**会话目录**；脚本路径同样支持「绝对 / skill 相对（`scripts/xxx.mjs`）/ session 相对」。

## 6. 脚本规范（run_script）

- 脚本统一 **Node**（`.mjs` 或 `.cjs`），用户机器不保证有 Python。
- 脚本经 `run_script` 执行，**不要读源码**；需要给 agent 看接口时，把用法写进 SKILL.md 或一个 `README.md` 由 `read_file` 读。
- 参数通过 `args` 数组传入（不拼 shell 字符串）；输出走 stdout/stderr；**非零退出码 = 失败**，agent 会据此 refine。
- 适合写成脚本的：数据聚合/清洗、HTML 渲染、PDF 后处理等确定性工作——**凡是能「跑一遍判断对错」的，尽量确定性脚本，别让 LLM 手搓**。

## 7. 编写规范（检查清单）

1. `name` 与目录名一致；`description` 含触发词。
2. SKILL.md 只写「阶段大纲 + 每步工具 + 校验标准 + 回退」，细节下沉 `references/`。
3. 每个阶段说明**用哪个工具、传什么关键参数**（尤其 `secid` 需先 `search_stock`）。
4. 明确**文件去向**：中间产物 `intermediate/`，报告 `output/`。
5. 明确**循环约定**：何时 `update_todo`、何时 `decide`、失败如何 refine。
6. 明确**数据缺失/异常**的处理（标「--」、不编造）。
7. 结尾带风险提示 / 免责声明（投资结论不构成投资建议）。
8. 能用脚本/确定性计算（因子、渲染、校验）的，不交给 LLM 判断。

## 8. 最小示例骨架

```yaml
---
name: my-strategy
description: 我的投资策略……（当用户需要分析……时使用）
params:
  - key: stock_code
    desc: 股票代码
---
# 我的策略流程

## 目标
一句话说清要产出什么。

## 步骤
1. search_stock 确定 secid。
2. …（逐条写工具 + 关键参数）
3. save_file(dir='output') 保存最终报告。

## 执行循环
- 开始前 update_todo 列步骤；
- 关键选择 decide 记理由；
- 每步执行后校验：……（写明校验标准）；
- 失败时 read_todo 恢复后重试或换方案；
- 完成后 update_todo 标 done。

## 注意
- 数据缺失标「--」；末尾风险提示；不做买卖承诺。
```

## 9. 扩展点备忘

- 加一个 skill = 在 `resources/skills/` 加目录 + 注册 `SKILL.md`（并在系统 prompt 或 `list_skills` 可见）。
- 加确定性能力 = 在 `factors/` 加因子（纯 TS 函数），或加一个工具。
- 校验（`verify.js`）当前是预留字段，未来硬循环会强制跑它，现在写 skill 时可先把「验收标准」写进正文。
