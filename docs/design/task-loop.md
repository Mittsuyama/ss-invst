# 模块设计 · 任务状态与软循环协议

> 对应 README 阶段 D（语义）与阶段 B（文件拆分）。回答：task/todo 的要求写在哪、循环写在哪。

## 1. 会话目录与三个文件语义

会话目录扩展为：

```
{workspace}/.ss-invst/sessions/{id}/
  meta.json          # 增加 currentSkill?: string
  messages.jsonl     # 完整 transcript（现状）
  task.md            # 目标 + 决策日志（append-only）
  todo.md            # 步骤光标（整体重写）
  intermediate/      # skill 中间产物
  output/            # skill 最终报告
  files/             # 通用生成文件（现状 save_file 默认）
  uploads/           # 用户上传（现状）
```

三份语义，职责严格分离：

| 文件 | 语义 | 写入方式 | 谁写 |
| --- | --- | --- | --- |
| `task.md` | 目标（不可变）+ 决策日志 | 目标段一次性写入；日志 **append** | 目标由首轮/手动写，日志由 `decide` 追加 |
| `todo.md` | 步骤光标 `- [ ]/[~]/[x]` | **整体重写** | `update_todo` |
| `messages.jsonl` | 完整对话 | append | 现有 `persistCurrentSession` |

为什么拆开：`task.md` 沉淀「意图 + 为什么」，压缩后能恢复脉络；`todo.md` 是「活的状态机光标」，需要频繁重写。混一个文件会互相干扰。

## 2. 三层责任：要求分别写在哪

这是本轮最重要的结构决策。`task/todo` 的「生成要求」拆成三层，各管各的：

| 层 | 内容 | 权威载体 |
| --- | --- | --- |
| **格式**（怎么表达） | todo 的 `{title,status}` 结构、`- [ ]/[~]/[x]` 语法；决策条目 `{decision,reason}` 与时间戳 | **工具 schema**（`update_todo` / `decide` 的 `parameters`） |
| **语义**（是什么、何时用） | task=目标+决策、todo=步骤光标、多步任务必维护 todo、压缩丢状态用 `read_todo`/读决策日志恢复 | **SYSTEM_PROMPT**（保持短，几行） |
| **流程**（做什么、分几步） | 「价值投资分 6 阶段，先取数再读 PDF 再出报告」 | **SKILL.md** |

推论：

- **格式永不写进 prompt 或 SKILL.md**。schema 是机器可读的，pi-agent 会把参数结构直接下发给 LLM，LLM 按结构填字段，格式天然正确。任何 skill 都不重复定义 todo 语法。
- **语义只写进 SYSTEM_PROMPT**，且保持几行，因为它是跨 skill 通用的、每轮都要在场的东西。
- **流程只写进 SKILL.md**，因为每个 skill 不同，且可被渐进披露（不常驻）。

## 3. 软循环协议（写在哪、长什么样）

循环骨架是跨 skill 通用的，必须**常驻** SYSTEM_PROMPT，但只写一行语义、不写细节：

```
复杂任务：decide 记决策 → 执行 → 校验结果 → update_todo 推进 / 失败 refine 重试
```

展开的「执行调哪些工具/脚本、refine 的回退动作」写进各 SKILL.md 的阶段大纲。

**循环体（LLM 自驱动）**：

```
decide（选方案，记入 task.md 决策日志）
  → execute（调工具 / run_script 脚本）
  → lint（检查结果：脚本 exit code、返回数据的完整性、报告结构）
  → ok  → update_todo 勾掉当前步、推进下一步
  → fail → refine（修正输入或改方案，重试）
```

## 4. 软循环的诚实边界 + 硬循环预留接缝

软循环的本质：以上是**写在 SKILL.md 里的约定**，由 LLM 自觉执行，可能「自我宣布完成」而不真跑校验。这是本版接受的代价。

预留的升级路径（本轮**不实现**）：

- 把「lint」设计成确定性脚本（`verify.js`，返回机器可读 `{ pass: boolean, errors: string[] }` + 非零 exit code）。
- 未来硬循环：引擎在每轮 `agent_end` 后强制 `run_script verify.js`，`fail` 时把错误列表作为下一条 user 消息灌回，配重试预算（如 3 次），预算耗尽判失败。

**关键**：skill 包格式、`run_script` 的 `{ exitCode, stdout, stderr }` 返回、`verify` 字段都已为硬循环预留，届时**不用改 skill 包格式**，只把「引擎强制 verify + 注入错误 + 重试预算」接进 `agent.ts`。

## 5. 压缩恢复

- 现状：`compactContext` 只压缩 `messages`，不碰 system prompt 和磁盘。
- 语义层要求「清单因压缩丢失时用 `read_todo` 恢复」→ `read_todo` 读 `todo.md`；决策脉络丢失时读 `task.md` 决策日志。
- 三者不冲突：`todo.md` / `task.md` 是磁盘真相，压缩只影响 LLM 上下文，不影响磁盘。

## 6. session-store 扩展清单

- `writeTodo(ws, id, items)` / `readTodo(ws, id)`：读写 `todo.md`（取代现在的 `writeTaskList`/`readTaskList` 写 `task.md` 的行为）。
- `writeTaskGoal(ws, id, goal)`：写 `task.md` 目标段（仅目标段）。
- `appendDecision(ws, id, {decision, reason})`：追加决策日志（时间戳 + 内容）。
- `readTask(ws, id)`：读 `task.md`（目标 + 决策日志）。
- `listSessionFiles` 扩展：`intermediate` / `output` 目录一并扫描（`SessionFileList` 增两字段）。
- `saveSessionFile` 扩展：支持 `dir: 'files'|'output'|'intermediate'`。

> 迁移注意：现有 `update_todo` 写 `task.md`（单文件设计），新方案改为写 `todo.md`；`task.md` 让位给「目标 + 决策日志」。这是语义层的硬改动，须在阶段 B 一并处理。
