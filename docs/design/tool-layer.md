# 模块设计 · 工具层（能力层）

> 对应 README 阶段 B。回答：skill 需要哪些新工具、task/todo 的「格式权威」放在哪。

## 1. 现有工具（15 个，保持不动）

| 工具 | 职责 | 分组 |
| --- | --- | --- |
| `update_todo` / `read_todo` | 任务清单读写（本轮改语义，见 task-loop.md） | 编排 |
| `download_url` / `web_search` | 下载 / 网络搜索 | 通用能力 |
| `compute_factor` / `analyze_factor` | 因子信号 / 回测统计 | 计算层 |
| `search_stock` / `get_quote` / `get_klines` / `get_financial_statements` / `get_business` / `get_dividends` | 东财数据 | 取数 |
| `tushare_query` | tushare 取数 | 取数 |
| `read_file` / `save_file` | 文件读写（本轮扩展） | 文件 |

## 2. 新增工具（4 个）

### 2.1 `list_skills`

- **语义**：列出可用的运行时 skill 索引，供自动路由。
- **parameters**：无。
- **返回**：`SkillInfo[]`（`name` + `description` + 可选 `params` 文档），每项一行文本。
- 数据来自 `skill-registry.listSkills()`。

### 2.2 `use_skill`

- **语义**：选定当前 skill，加载其 `SKILL.md` 全文。
- **parameters**：
  ```ts
  { name: Type.String({ description: 'skill 名，来自 list_skills' }) }
  ```
- **副作用**：调 `applySkill(name)`——拼接 system prompt 独立段、记录 `sessionRuntime.currentSkill`、写 `meta.json`。
- **返回**：`SKILL.md` 全文（便于 LLM 立即看到流程，也进 messages 留痕可审计）。若 name 无效则 throw（pi 标记 isError）。

### 2.3 `run_script`

- **语义**：执行 skill 内脚本。这是 skill 从「一份 md」升级成「可执行包」的关键。
- **parameters**：
  ```ts
  {
    script: Type.String({ description: '脚本相对路径或绝对路径，如 scripts/render-report.mjs' }),
    args: Type.Optional(Type.Array(Type.String())),
    timeoutSec: Type.Optional(Type.Number()),
  }
  ```
- **执行**：主进程用 **`utilityProcess.fork()`**（Electron 内建 Node 子进程，无需用户装 Node）跑脚本。
  - 解析：`script` 若为相对路径，先试 skill 根目录（`resolveSkillPath`），再试 session 目录。
  - `cwd` = session 目录（`sessionRuntime.workspacePath` 下的会话目录）。
  - 超时默认 120s，可配。
  - 捕获 stdout / stderr / exit code，输出截断（复用 `toText` 的截断策略）。
- **返回**：`{ exitCode, stdout, stderr, timedOut }`。非零退出码 throw，错误信息带 stderr。
- **安全边界**：
  - 脚本路径经 `resolveSkillPath` 越界校验；
  - `args` 作为参数数组传入（不拼 shell 字符串，避免注入）；
  - 不提供任意 shell 命令执行，只有「跑 Node 脚本 + 参数」。

### 2.4 `decide`

- **语义**：追加一条决策到 `task.md` 的决策日志（记录「为什么这么选」）。
- **parameters**：
  ```ts
  {
    decision: Type.String({ description: '决策内容' }),
    reason: Type.Optional(Type.String({ description: '理由' })),
  }
  ```
- **副作用**：`appendDecision(entry)` 追加到 `task.md` 的 `## 决策日志` 段（带时间戳），并 emit `decision_update`。
- **返回**：确认文本。

## 3. 现有工具扩展

### 3.1 `read_file` — 三路径

`path` 参数支持三种解析顺序：

1. **绝对路径**（现状）；
2. **skill 相对路径**：当前有 skill 且 `resolveSkillPath` 命中（如 `references/估值方法.md`）；
3. **session 相对路径**：相对 session 目录（如 `output/2025-report.md`）。

删除现有的 `resolveReferenceDoc` 内置命中逻辑（被 skill 路径接管）。

### 3.2 `save_file` — 分目录

新增可选 `dir` 参数：

```ts
{ path: ..., dir: Type.Optional(Type.Union([Type.Literal('files'), Type.Literal('output'), Type.Literal('intermediate')])) }
```

- `files`（默认）：通用生成文件，现状行为。
- `output`：skill 最终报告。
- `intermediate`：skill 中间产物。

session-store 对应新增目录扫描与写函数（见 task-loop.md 第 4 节）。

## 4. 关键原则：格式的权威来源是 schema，不是 prompt

`task.md` / `todo.md` 的「怎么表达」由**工具 schema** 定义死，prompt 里不复述语法：

- `update_todo` 的 `parameters` 定义 todo 条目结构 `{ title, status: pending|in_progress|done }`；渲染成 `- [ ]/[~]/[x]` 是 main 的确定性转换，LLM 只填结构。
- `decide` 的 `parameters` 定义决策条目结构 `{ decision, reason }`；时间戳、`## 决策日志` 的 Markdown 格式由 main 拼。

这样 LLM 按 pi-agent 下发的 schema 填字段，格式天然正确；prompt 只需写「何时调、语义区别」，不写语法细节。此原则在 task-loop.md 第 2 节展开。

## 5. 工具需要 emit 能力（依赖注入）

`update_todo` / `decide` / `use_skill` 要在写文件/切 skill 的同时向 renderer 发事件。现有工具是「纯函数返回结果」，不直接发事件。

改造：`createTools()` 的签名扩展为 `createTools(emit: (e: AgentEvent) => void)`，把 `emit` 注入需要发事件的工具。`use_skill` 额外需要 `applySkill` 回调。这是既有架构的自然延伸，不是新机制。

## 6. 边界

- 工具只做「执行 + 返回 + 投影」，不做循环判断（循环是 LLM 的事，见 task-loop.md）。
- `run_script` 只跑 Node 脚本，不提供任意 shell；Python 脚本不在本轮能力范围内。
- 所有写文件工具统一走 session-store，禁止工具自己拼路径写盘。
