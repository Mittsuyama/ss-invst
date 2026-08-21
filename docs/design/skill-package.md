# 模块设计 · Skill 包与注册表

> 对应 README 阶段 A。回答两个问题：skill 长什么样、怎么从磁盘加载进 agent。

## 1. 核心原则

- **skill 是数据，不是代码**：以真实文件形态分发，不烧进 JS bundle、不放进 asar。
- **渐进披露**：只有 `SKILL.md` 全文进上下文；`references/`、`templates/` 按需 `read_file`；`scripts/` 只执行、不读源码。
- **内置只读**：本轮只有内置 skill（`extraResources`），不支持用户新增/编辑。

## 2. 目录格式

```
resources/skills/
  value-investing/
    SKILL.md            # 入口：frontmatter + 阶段大纲（保持短）
    references/         # 按需读的知识：估值方法、报表字段、检查清单
    templates/          # report.md / report.html 模板
    scripts/            # Node 脚本（.mjs/.cjs），可执行、不读源码
    verify.js           # 确定性验收（预留，本轮不写）
  technical-signal/
    SKILL.md
    ...
  factor-research/
    SKILL.md
    ...
```

约定：一个目录 = 一个 skill，目录名即 skill 名（`name`）。子目录名用 `references/`、`templates/`、`scripts/` 固定语义，其余文件不特殊处理。

## 3. SKILL.md frontmatter

```yaml
---
name: value-investing              # 必填，与目录名一致
description: 长线价值投资分析……     # 必填，含触发词，用于路由
params:                            # 可选，仅文档化（本轮不做表单）
  - key: stock_code
    desc: 股票代码，如 600519
verify: verify.js                  # 可选，指向 lint 脚本（本轮不写，字段先留）
---
```

frontmatter 只做「索引 + 路由 + 可选元数据」，正文才是流程。解析用最小 YAML 解析（手写正则或轻量库，只取 `name/description/params/verify` 四键，不解析嵌套复杂结构）。

## 4. 注册表模块 `skill/`

### 4.1 `skill-paths.ts` — 目录解析

```ts
// dev：仓库根 resources/skills；prod：process.resourcesPath/skills
function skillRootDir(): string
```

用 `@electron-toolkit/utils` 的 `is.dev` 判断。这是 dev/prod 唯一需要分叉的点，其余代码不感知环境。

### 4.2 `skill-registry.ts` — 扫描 + 索引 + 加载

```ts
interface SkillInfo {
  name: string;
  description: string;
  params?: { key: string; desc: string }[];
  rootDir: string;          // skill 绝对根目录
}

interface SkillPackage extends SkillInfo {
  markdown: string;         // SKILL.md 全文
}

function scanSkills(): SkillInfo[]          // 启动扫一次，缓存索引
function listSkills(): SkillInfo[]          // 供 LLM / UI 用（不含 markdown）
function loadSkill(name: string): SkillPackage | undefined
function resolveSkillPath(name: string, rel: string): string | undefined  // 校验 rel 不越出 rootDir
```

- 扫描：读 `skillRootDir()` 下每个子目录的 `SKILL.md`，解析 frontmatter；解析失败跳过并打日志，不影响启动。
- 路径安全：`resolveSkillPath` 必须保证 `path.resolve(rootDir, rel)` 落在 `rootDir` 内（`read_file`/`run_script` 的 skill 相对路径都走它校验）。
- 缓存：`scanSkills()` 结果和已加载的 `SkillPackage` 都缓存；内置 skill 只读，无需失效机制。

## 5. 打包 `extraResources`

`electron-builder.yml` 增加：

```yaml
extraResources:
  - from: resources/skills
    to: skills
```

效果：安装后 skill 以真实文件落在 `process.resourcesPath/skills`，**不进 asar、不进 bundle**，可被脚本执行、可被 `read_file` 读取。

现有 `electron-builder.yml` 里 `- '!src/*'` 只排除 `src/`，不影响 `resources/`。注意当前 `asarUnpack: resources/**` 已存在——skill 走 `extraResources` 落在 asar **之外**，与 `asarUnpack` 无关。

## 6. 路由：自动 + 手动

### 6.1 自动（LLM 决策）

- SYSTEM_PROMPT 只放一句：「有内置 skill 可用，涉及专业流程先 `list_skills`，再 `use_skill` 选定」。
- `list_skills` 工具返回 `SkillInfo[]`（name + description 一行）。
- LLM 判断命中后调 `use_skill(name)`，把该 `SKILL.md` 全文加载为当前 skill。

### 6.2 手动（UI 下拉）

- UI 下拉数据源 = `listSkills()` 结果。
- 选中后随 `AgentPromptPayload.skill` 传给 main，main 调同一套 `applySkill(name)`（见下）。
- 手动选中 = **钉住**：LLM 不覆盖，除非用户在下拉里清空（选「无 skill」）。

### 6.3 统一入口 `applySkill(name)`

```ts
function applySkill(name: string | undefined): void
```

两种路由最终都调它，它负责：

1. `loadSkill(name)` 拿全文；
2. 把 `SKILL.md` 拼进 system prompt 的**独立段**（`## 当前技能\n\n<SKILL.md 全文>`），替换旧段而非追加；
3. 记录 `sessionRuntime.currentSkill`，并随 session 保存写入 `meta.json`（重开会话可恢复当前 skill）。

**为什么用「注入 system prompt 独立段」而不是「use_skill 返回全文进 messages」**：

- skill 指令需**稳定常驻**每一轮，放进 messages 会被压缩摘要掉、也会被后续消息稀释；
- 独立段与主 SYSTEM_PROMPT 分离，主 prompt 保持短，切换 skill 只替换该段；
- 现有 `compactContext` 只压缩 messages、不动 system prompt，skill 段天然免于被压缩。

## 7. 与现有机制的关系 / 迁移

- 现有 `src/main/agent/reference/{value-investing,technical-signal,factor-research}.md` 三个 playbook → 迁移为 `resources/skills/` 下三个 skill 的 `SKILL.md` 正文。
- 删除 `src/main/agent/reference/index.ts` 与 `src/main/env.d.ts` 的 `?raw` 机制，`system-prompt.ts` 里「读内置参考文档」的说法改为「list_skills/use_skill」。
- `read_file` 的内置命中逻辑（`resolveReferenceDoc`）删除，改由 skill 相对路径解析接管（见 `tool-layer.md`）。

## 8. 边界与风险

- **skill 不被用户编辑**：内置只读，本轮明确不做安装/管理 UI，避免把「开发期 skill」和「运行时 skill」混为一谈。
- **YAML 解析要保守**：只取四个键，异常值跳过该 skill，绝不让解析错误拖垮启动。
- **路径逃逸是安全底线**：`resolveSkillPath` 的越界校验是 `read_file`/`run_script` 允许 skill 相对路径的前提，必须最先实现并测试。
