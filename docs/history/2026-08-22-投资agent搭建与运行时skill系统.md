# 投资 Agent 搭建与运行时 Skill 系统

> 会话时间：2026-08-22 · 项目：`ss-invst`（Electron 桌面端 A 股投研智能体）

## 一句话概述

用 `@earendil-works/pi-ai` + `@earendil-works/pi-agent-core` 在 Electron 应用里自建了一个投资分析 Agent，
并围绕它搭起「会话持久化 / 运行时 Skill / 计划-执行-校验循环 / 因子计算回测 / 研报 PDF」等一整套骨架。

## 技术栈

- Electron 37 + React 19 + TypeScript + electron-vite 4（Vite 7）+ Tailwind 4 + shadcn 风格组件 + jotai
- `@earendil-works/pi-ai@0.74.2` + `@earendil-works/pi-agent-core@0.74.2`（主进程 CJS，ESM-only 包用动态 `import()` 懒加载）
- `pdfjs-dist`（财报 PDF 提文字）、`markdown-it`（报告渲染）、`@radix-ui/react-checkbox`

## 架构与模块拆分

三端进程模型：渲染进程（React UI）⇄ Preload（contextBridge）⇄ 主进程（Agent 宿主）⇄ pi-agent-core/pi-ai；磁盘上有 `resources/skills/`（技能包）与 `workspace/.ss-invst/sessions/`（会话）。

主进程 Agent 拆成 7 个目录（`src/main/agent/`）：

| 目录 | 职责 |
| --- | --- |
| `agent.ts` | Agent 单例 + IPC 注册 + 事件桥 + `applySkill` |
| `pi.ts` | pi 包 ESM 懒加载 |
| `models.ts` | LLM 配置 → pi-ai `Model`（deepseek/custom 走 openai-completions） |
| `system-prompt.ts` | 短系统提示（十几行） |
| `compaction.ts` | 内存级上下文压缩兜底 |
| `tools/` | 21 个工具（每工具一文件，`createTools(ctx)` 组装） |
| `factors/` | 4 个因子纯函数 + 事件驱动回测 |
| `data/` | 东方财富 / Tushare / 下载 / 读文件 / 指标 / 字段中文化 |
| `skill/` | skill 注册表（frontmatter 扫描 + 加载） |
| `session/` | 会话持久化（jsonl 增量 + meta + task/todo + 文件） |

## 关键实现

### Agent Loop
- `new core.Agent({ initialState:{systemPrompt,model,tools}, streamFn: ai.streamSimple, toolExecution:'parallel' })`
- `subscribe` 把内部事件翻译成 14 种 `AgentEvent` 推给渲染进程；`transformContext` 接压缩；`getApiKey` 供凭据。
- **原子化单例**：用「在途 Promise」`agentPromise` 修复首次打开/点历史记录时并发建多个 Agent 导致重复订阅卡死。

### 计划-执行-校验循环（软循环）
- `task.md` = 目标（可覆盖）+ 决策日志（`decide` 只追加）；`todo.md` = 步骤光标（`update_todo` 整体重写 `- [ ]/[~]/[x]`，`read_todo` 恢复）。
- 循环骨架在 system prompt：`decide 记决策 → 执行 → 校验 → update_todo 推进 / 失败 refine 重试`。
- `verify.js` 字段已预留，未来硬循环强制跑确定性校验（当前未强制）。

### 运行时 Skill 系统（扩展机制）
- `resources/skills/<name>/SKILL.md`（frontmatter `name/description/params/verify`）+ `references/`、`templates/`、`scripts/`、`verify.js`。
- `list_skills`/`use_skill` 自动路由 + `payload.skill` 手动路由（输入框下拉）。
- `use_skill` 把 SKILL.md 全文注入 system prompt 的**独立段**（不进消息历史，压缩不掉）；切 skill 只替换该段。
- 内置 4 个：`value-investing`、`technical-signal`、`factor-research`、`financial-report-analysis`。
- 渐进披露：SKILL.md 短，细节下沉 references/，脚本经 `run_script`（utilityProcess，cwd=会话目录，非零退出=失败）执行。

### 上下文压缩（compaction.ts）
- 仅在接近窗口上限时触发（预留 4096、保留最近 12000 token）；`findCutPoint` 找最近 user 消息作干净切点；`generateSummary` 压早期历史（投资定制指令），失败退化为截断。
- 只影响喂给 LLM 的上下文，磁盘 jsonl 保留全量。

### 会话持久化
- `workspace/.ss-invst/sessions/<id>/`：`meta.json`（title/messageCount/currentSkill）+ `messages.jsonl`（增量 append）+ `task.md` + `todo.md` + `uploads/files/intermediate/output` 四目录。
- meta 原子写（`.tmp` + rename）；`save_file` 默认 `files/`，skill 报告进 `output/`。

### 事件系统
- 单一通道 `agent:event`，事件 union 含 run_start/end、assistant_text/thinking_delta、tool_start/update/end、todo_update、decision_update、skill_applied、file_saved、error。

### 因子与回测
- `FACTORS`：`macd_cross`、`ma_cross`、`rsi_reversal`、`boll_breakout`（纯 TS 函数）。
- `evaluateSignals`：事件驱动回测 → 胜率 / 赔率（profit factor）/ 平均盈亏 / 逐笔明细。

### 研报 PDF（东财）
- `list_report_pdfs(secid)` 列研报（published = `PUBLISH_SITUATIONS.startsWith('AN')`）→ `download_report_pdf(secid, publish_situations)` 换 `attach_url` 下载到 uploads/，发 `file_saved` 事件出文件卡片。

## UI 侧里程碑

- 左历史树 + 右可展开面板（文件/待办/调试 tabs）；输入框重设计（圆角、textarea、左上传+skill 选择、右展开+发送）。
- 工具调用默认展开、出正文后自动折叠（修复了工具与正文分属两条消息导致不折叠的问题）；每轮文件卡片（2/行、可点击打开）。
- markdown 用 `markdown-it`（linkify + 外链 target=_blank + 阻断 js/vbscript/file 协议）；LLM 错误友好提示并推送渲染层。

## 关键修复

1. 渲染进程首次打开/点历史卡死 → `agentPromise` 原子化懒初始化。
2. 工具不自动折叠 → 正文出现时同时折叠「同消息」与「前序消息」的工具。
3. `markdown-it` 类型注解、`attrGet` 返回类型、`computeMA` null 值等 typecheck 问题。
4. Windows 写文件偶发 `EIO 1175` → 重试写成功。

## 产物与文档

- `docs/tech-solution.html`：本次会话末尾生成的完整技术方案讲解（自包含 HTML，12 节，含架构框图与 21 工具清单）。
- `docs/design/{README,skill-package,tool-layer,task-loop,events-ui}.md`：分层设计文档。
- `.agents/skills/investment-skill-authoring/SKILL.md`：编写运行时 skill 的 meta-skill（其工具清单为 19 个，缺 `list_report_pdfs`/`download_report_pdf` 两个，**待更新**）。
- `.agents/skills/brainstorming/`：`npx skills add obra/superpowers --skill brainstorming` 安装。

## 已知问题 / 待办

- `investment-skill-authoring` 的 tool 列表未含新增的 2 个研报 PDF 工具。
- 历史会话文件卡片路径靠 `sessionFilePath` 重建，`download_url` 去重后缀 `-1/-2` 可能对不上（已知边角）。
- 运行期行为（真实接口、LLM 流、skill 注入效果）仅静态构建验证过，未在运行时实测。
- 校验 `verify.js` 仍是预留，硬循环未落地。

## 约束备忘

- Agent 由用户自己运行（`npm run dev`/`start`），助手只做 `npm run build` 静态验证。
- 主进程 CJS + pi 包 ESM-only，所有 pi 引用走 `loadPi()`。
