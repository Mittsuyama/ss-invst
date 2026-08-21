# 运行时 Skill 系统 · 设计总览

> 状态：**设计稿，待审核**。审核通过前不写实现代码。
> 相关文档：本目录下 `skill-package.md`、`tool-layer.md`、`task-loop.md`、`events-ui.md`。

## 1. 背景与目标

当前投资 agent 的能力是「编译期固定」的：工具（`src/main/agent/tools/`）、知识（`reference/*.md` 用 `?raw` 烧进 main bundle）、因子（`factors/`）都是写死在代码里。随着价值投资这类复杂流程越来越重（取数 → 下载/读取 PDF → 中间文件 → 报告/HTML），单个 md 无法承载，需要一套**可组合、可执行、可扩展**的运行时 skill 系统。

目标：

- 把「知识 + 脚本 + 模板 + 校验」打包成一个 **skill**，运行时按需加载。
- 复杂 skill 不被 `?raw` 烧进 bundle，而是作为**磁盘资产**随安装包分发（`extraResources`）。
- skill 驱动一条可自我循环的执行协议：`task → todo → decide → execute → lint → (ok) todo 更新 / (fail) refine`。

## 2. 术语表

| 术语 | 含义 |
| --- | --- |
| 开发期 skill | `.agents/skills/`，给 Claude Code / Copilot / DSH 写这个 app 用。**本设计不涉及。** |
| 运行时 skill | `resources/skills/`，给 Electron 里的 pi-agent 投资 agent 用。**本设计对象。** |
| task.md | 会话级「目标 + 决策日志」，append-only，意图不可变。 |
| todo.md | 会话级「步骤光标」，可重写，标记当前步 / 剩余步。 |
| 软循环 | LLM 依 SKILL.md + SYSTEM_PROMPT 自驱动的 plan-execute-verify，无引擎强制。 |
| 硬循环 | 引擎强制 verify + 注入错误 + 重试预算。本版不实现，仅预留接缝。 |
| 能力层 / 知识层 / 计算层 | 既有分层：工具 / skill 知识 / factors 确定性计算。 |

## 3. 已确认决策（拍板记录）

1. 打包：仅内置 `extraResources`，不做用户全局 skill 目录、不做 UI 安装/管理 skill。
2. 脚本运行时：**Node 优先**，Python 不做硬依赖。
3. 循环：先**软循环**，硬循环预留接口。
4. `task.md` 与 `todo.md` **拆成两个文件**。
5. skill 选择：**自动（LLM）+ 手动（UI 下拉）** 都要。
6. 会话产物：`intermediate/` 与 `output/` 分目录（与 `files/`、`uploads/` 并列）。
7. `verify.js` 本轮不写。
8. skill `params` 仅 frontmatter 文档化，不做表单。
9. 右面板新增「待办」Tab；输入框旁 skill 下拉 + 会话徽标。
10. 运行时 skill 与开发期 skill **彻底分离**。

## 4. 模块划分

### 4.1 主进程 `src/main/agent/`

| 模块 | 职责 | 关键入口 |
| --- | --- | --- |
| `skill/`（新增） | skill 包扫描、frontmatter 解析、索引、按名加载、路径解析 | `listSkills()` / `loadSkill(name)` / `resolveSkillPath(name, rel)` |
| `tools/`（扩展） | 能力层：现有 15 个工具 + 新增 `list_skills` / `use_skill` / `run_script` / `decide` | `createTools()` |
| `session/`（扩展） | 会话状态：`task.md` / `todo.md` 分离、决策日志 append、`intermediate/` / `output/` 目录 | session-store 新增函数 |
| `events/`（新增或并入 agent.ts） | 事件投影：把工具副作用投影成 `todo_update` / `decision_update` / `skill_applied` | `emit` 注入工具 |
| `agent.ts`（扩展） | 编排：skill 应用（拼接 system prompt）、软循环约定注入、会话加载时初始投影 | `applySkill(name)` |

### 4.2 共享 `src/shared/src/types/`

| 模块 | 职责 |
| --- | --- |
| `agent.ts`（扩展） | `AgentEvent` 新增 `todo_update` / `decision_update` / `skill_applied`；新增 `SkillInfo`；`AgentPromptPayload.skill?` |
| `session.ts`（扩展） | `SessionMeta.currentSkill?`；session 目录结构常量与注释 |

### 4.3 渲染进程 `src/renderer/src/`

| 模块 | 职责 |
| --- | --- |
| `models/skill.ts`（新增） | `skillIndexAtom`、`currentSkillAtom` |
| `models/todo.ts`（新增） | `todoAtom`、`decisionAtom` |
| `components/SkillSelector.tsx`（新增） | 输入框旁下拉 |
| `components/TodoTab.tsx`（新增） | 右面板「待办」Tab（待办 + 决策日志） |
| `RightPanel.tsx`（扩展） | 增加「待办」Tab |
| `AgentChat.tsx`（扩展） | 输入框旁 skill 下拉 + 会话徽标 |
| `preload/index.ts`（扩展） | `agent.listSkills()`、prompt payload 带 `skill` |

## 5. 架构关系图

```
resources/skills/value-investing/        ← 磁盘资产（extraResources 分发）
  SKILL.md  references/  templates/  scripts/  verify.js(预留)

        │ 启动扫描，仅 SKILL.md frontmatter 进索引
        ▼
skill-registry ── list_skills ──► LLM（自动路由） / UI 下拉（手动路由）
        │  use_skill(name) → 加载 SKILL.md 全文，拼进 system prompt 独立段
        ▼
pi-agent（软循环）── tools/（取数、文件、run_script、decide、todo）
        │
        ├─ task.md（目标+决策日志, append）
        ├─ todo.md（步骤光标, 重写）
        ├─ intermediate/  output/  files/  uploads/
        │
        └─ emit ──► renderer：todoAtom / decisionAtom / currentSkillAtom
                      └─ 右面板「待办」Tab、输入框旁下拉、会话徽标
```

## 6. 文档索引

- `skill-package.md`：skill 目录格式、frontmatter、注册表、打包与路径解析、渐进披露、路由。
- `tool-layer.md`：工具层全景，新增 4 个工具的 schema 与语义，`save_file` 分目录，`read_file` 三路径。
- `task-loop.md`：task/todo/决策日志三份语义、三层责任划分、软循环协议、硬循环预留接缝。
- `events-ui.md`：事件投影、renderer 状态、右面板「待办」Tab、skill 下拉 + 徽标、IPC/preload 扩展。

## 7. 实施顺序（审核通过后执行）

分四个阶段，每阶段可独立构建与验证：

1. **阶段 A · skill 包与注册表**：`skill/` 模块 + `extraResources` 打包 + 把现有 `reference/*.md` 迁移为三个内置 skill；删掉 `?raw` / `REFERENCE_DOCS` 机制。
2. **阶段 B · 工具层**：新增 `list_skills` / `use_skill` / `run_script` / `decide`；扩展 `read_file`、`save_file`；拆分 `task.md` / `todo.md`。
3. **阶段 C · 事件与 UI**：事件投影、renderer atoms、右面板「待办」Tab、skill 下拉 + 徽标、preload/IPC 扩展。
4. **阶段 D · 软循环协议**：SYSTEM_PROMPT 加一行循环骨架 + SKILL.md 写流程，端到端跑通一个 value-investing 样例。

> 说明：阶段 A 是其余阶段的地基，B/C/D 相互依赖较少，可在 A 完成后并行推进。
