# 模块设计 · 事件投影与 UI

> 对应 README 阶段 C。回答：renderer 如何实时看到待办进度、如何手动选 skill。

## 1. 核心原则：文件是真相，事件是投影

- **磁盘文件**（`todo.md` / `task.md`）是持久化真相，负责「重开会话能恢复、压缩后能找回」。
- **事件流**（`todo_update` / `decision_update` / `skill_applied`）是实时投影，负责「UI 实时显示进度」。
- UI 永远只消费事件，**不直接读文件**；文件只服务持久化。两者职责分离，就不会出现「UI 显示与磁盘不一致」。

## 2. AgentEvent 扩展（`src/shared/src/types/agent.ts`）

在现有事件 union 上新增三个语义事件：

```ts
| { type: 'todo_update'; items: { title: string; status: 'pending' | 'in_progress' | 'done' }[] }
| { type: 'decision_update'; entry: { time: string; decision: string; reason?: string } }
| { type: 'skill_applied'; name: string | null; description?: string }
```

- `todo_update`：`update_todo` 工具写盘后，把结构化清单投影出来。
- `decision_update`：`decide` 工具追加决策后投影单条（append 语义，renderer 追加而非替换）。
- `skill_applied`：`applySkill(name)` 后投影，`name: null` 表示清空 skill。

## 3. 主进程：emit 注入与初始投影

### 3.1 注入

`createTools(emit)` 把 `emit` 传给 `update_todo` / `decide` / `use_skill`（见 tool-layer.md 第 5 节）。工具执行时：

1. 先写盘（真相）；
2. 再 emit 结构化事件（投影）。

### 3.2 会话加载的初始投影

`SESSION_LOAD` handler 在返回快照前，主动发：

- `todo_update`（读 `todo.md` 解析出 items；空则发 `[]`）；
- `skill_applied`（读 `meta.json` 的 `currentSkill`）；
- （可选）`decision_update` 按时间顺序把已有决策日志逐条发一遍。

这样切会话/重开后，「待办」Tab 和会话徽标立即有内容，无需 renderer 额外拉取。

## 4. Renderer 状态（jotai）

新增两个 model 文件：

```ts
// models/skill.ts
skillIndexAtom = atom<SkillInfo[]>([])          // list_skills 结果
currentSkillAtom = atom<{ name: string; description?: string } | null>(null)

// models/todo.ts
todoAtom = atom<TodoItem[]>([])                 // { title, status }
decisionAtom = atom<{ time: string; decision: string; reason?: string }[]>([])
```

事件订阅：在现有 `onEvent` 订阅里（Home.tsx 已有一处），按 `type` 分流到对应 atom：

- `todo_update` → 整体替换 `todoAtom`；
- `decision_update` → 追加 `decisionAtom`；
- `skill_applied` → 更新 `currentSkillAtom`。

会话切换时（`selectSession` / `newSession` / `deleteSession` 等）重置这三个 atom，与 `chatMessages` 一起清空。初始投影事件会随后把它们填上。

## 5. UI 组件

### 5.1 右面板「待办」Tab（`TodoTab.tsx`）

`RightPanel.tsx` 的 `tab` union 从 `'files' | 'debug'` 扩为 `'files' | 'todo' | 'debug'`，新增一个 Tab 按钮（图标如 `ListChecks`）。

`TodoTab` 内容：

- **待办**：渲染 `todoAtom`，`- [ ]/[~]/[x]` 三态，`in_progress` 高亮（如 `bg-accent`），空态显示「暂无任务」。
- **决策日志**（折叠区）：渲染 `decisionAtom`，每条「时间 + 决策 + 理由」。

纯展示，无交互（本轮不提供手改待办，改动走 agent 的 `update_todo`）。

### 5.2 skill 下拉 + 会话徽标（`SkillSelector.tsx` + AgentChat 扩展）

- **下拉**：放在聊天输入框旁。数据源 `skillIndexAtom`，含「无 skill」选项。挂载时调 `window.agent.listSkills()` 填充。
- **徽标**：会话顶部/输入框上方显示 `currentSkillAtom` 的名称（如 `value-investing`），无 skill 时不显示。
- **行为**：用户选择后写 `currentSkillAtom`，并在下一次 `prompt` 的 `AgentPromptPayload.skill` 里带上该 name；选择「无 skill」则带 `null`。

## 6. preload / IPC 扩展

`src/preload/index.ts` 的 `agent` bridge 新增：

```ts
listSkills: () => ipcRenderer.invoke(AGENT_LIST_SKILLS_CHANNEL)   // Promise<SkillInfo[]>
```

`AgentPromptPayload` 增加可选字段：

```ts
skill?: string | null   // 手动选中的 skill 名；null = 明确清空
```

main 侧新增 `AGENT_LIST_SKILLS_CHANNEL` handler 返回 `skillRegistry.listSkills()`；`AGENT_PROMPT_CHANNEL` handler 里，若 `payload.skill` 为字符串则调 `applySkill(payload.skill)`，为 `null` 则 `applySkill(undefined)` 清空。

> 自动路由（LLM 调 `use_skill`）与手动路由（payload.skill）最终都收敛到 `applySkill`，无需两套逻辑。

## 7. 边界

- 本轮「待办」Tab 只读展示，不做可交互的勾选/拖拽（避免与 agent 的 `update_todo` 真相源打架）。
- `decisionAtom` 只 append、不清空（除非切会话）。
- 事件走现有 `AGENT_EVENT_CHANNEL` 单通道，不新增通道；debug 面板自动能看到新事件，天然可调试。
