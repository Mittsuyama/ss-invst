---
name: weread-notes-to-wiki
description: 把微信读书导出的划线笔记整理成 llms.txt 渐进式披露知识库。当用户需要：把微信读书笔记/划线导出做分类分级、提炼成可检索的知识点文件、生成 llms.txt 目录、把一批书的读书笔记变成一套结构化知识库、或想给已有知识库做引文忠实性校验时使用。
---

# 微信读书笔记 → llms.txt 知识库

把「微信读书导出的一批书 + 划线笔记」变成三层渐进式披露知识库：

```
<out>/llms.txt                  一级目录：分类名 + 描述 + 分类目录地址
<out>/<category>/llms.txt       二级目录：主题簇 → 知识点名 + 描述 + txt 地址
<out>/<category>/<slug>.txt     知识点正文：判断 / 要点 / 边界与反例 / 原文锚点
```

读取方（人或 LLM）每层只加载需要的那一层，不必一次吞下整个知识库。

## 何时用 / 何时不用

- **用**：素材是微信读书导出目录（含 `index.json` 与 `books/*.json`），规模几十本以上，划线总量在几万字以上。
- **不用**：只有一两本书、几百条划线。直接读素材写结论更快，套这条流水线是浪费。

## 六阶段流程

| 阶段 | 做什么 | 产出 | 门禁 |
|---|---|---|---|
| 1 解析 | `extract-notes.mjs` 把导出 JSON 摊成每本书一份可读文本 | `<work>/notes/*.md` + `_index.json` + `meta.json` | 划线总数与导出摘要对得上；**逐条看完 `meta.json` 的 warnings** |
| 2 精读 | `make-batches.mjs` 切批，并行子 agent 每批产出「每本书的主题 + 父分类候选 + 知识点候选」 | `<work>/survey/batch-NN.json` | 覆盖 100% 的书（对照 `_index.json`） |
| 3 父分类 | 汇总成一级分类方案（6–12 个） | 分类清单 | **必须停下来给用户确认，确认前不许进入阶段 4** |
| 4 合并 | 书→分类映射；每分类一个 agent 合并同义/拆分过宽 → 知识点清单 | `<work>/kp/<category>.json` | 禁止发明候选里没有的知识点 |
| 5 撰写 | 按每 6 个知识点切组，并行子 agent 写正文 | `<out>/<category>/<slug>.txt` | 无源支撑就跳过，不写空壳 |
| 6 校验 | 版式 → 完整性 → 引文忠实性 → 链接 | `llms.txt` × (1 + N) | 四条校验全绿才算完成 |

阶段 2/4/5 都要用 `workflow` 工具扇出（脚本体用 `agent()` + `parallel()`）。可复制的提示词全文见 `references/prompts.md`。

## 5 条硬性规则

违反任何一条，知识库就会变成「看起来很像但不可信」的东西。

1. **内容只能来自划线原文。** 禁止用模型自己的领域知识补写数字、案例、机制或结论。笔记没说的就不写。
2. **`原文锚点` 必须逐字连续。** 可截断，不可改写一个字；**不许用 `……` 把不相连的两句拼成一句**。写完由 `verify-quotes.mjs` 兜底。
3. **找不到支撑就跳过或删掉，绝不留空壳。** 宁可少一个知识点，也不要一个写着「笔记中未记录」的文件。
4. **一个知识点 = 一个原子判断。** 能写成「X 是 Y」或「如果……则……」。要两层嵌套说明它其实是两个知识点。
5. **合并阶段禁止从书名推断知识点。** 候选必须来自子 agent 在真实划线里读出来的内容；凭书名「这本书应该讲中央地方关系」造出来的条目，最后一定会变成空壳。

细则见 `references/knowledge-point-spec.md`。

## 脚本

全部零依赖 Node（`node:fs` / `node:path`），路径一律走命令行参数。

| 脚本 | 用法 | 作用 |
|---|---|---|
| `extract-notes.mjs` | `<rawDir> <workDir>` | 导出 JSON → 每本书可读 md + `_index.json` + `meta.json`（含数据质量警告） |
| `make-batches.mjs` | `<notesDir> <outDir> [targetChars] [minItems]` | 切并行精读批次 + `_manifest.json` |
| `build-index.mjs` | `<categories.json> <kpDir> <llmRoot> [workDir]` | 生成 N 个分类 `llms.txt` + 根 `llms.txt` |
| `lint-kp.mjs` | `<categoryDir> [--check]` | 版式检查并自动修（H1 补 slug、切开粘连标题） |
| `verify-notes.mjs` | `<categories.json> <kpDir> <llmRoot>` | 落盘完整性 + 结构一致性 + `相关` 引用 + 跨分类 slug 冲突 |
| `verify-quotes.mjs` | `<notesDir> <llmRoot>` | **核心质量闸门**：全部引文逐字回查原始语料 |
| `verify-links.mjs` | `<llmRoot>` | 三层目录链接自洽 |

`categories.json` 的格式：

```json
[{ "slug": "financial-statements", "zh": "财报分析与舞弊识别", "desc": "三张报表怎么读、怎么重构、怎么排雷……" }]
```

## 完成判据

阶段 6 这四条必须全绿，缺一不可：

```bash
node scripts/lint-kp.mjs   <out>/<category> --check   # 每个分类都跑一遍
node scripts/verify-notes.mjs  categories.json <work>/kp <out>
node scripts/verify-quotes.mjs <work>/notes <out>
node scripts/verify-links.mjs  <out>
```

- `verify-notes` → `缺 0 / 多 0 / 全部引用可解析 / 无冲突`
- `verify-quotes` → `无法逐字命中 = 0`
- `verify-links` → `失效 = 0`

任何一条不绿都要先修，不许「基本通过」交付。

## 参考文档

| 文件 | 内容 |
|---|---|
| `references/data-format.md` | 微信读书导出结构、字段含义、同书多记录陷阱 |
| `references/pipeline.md` | 六阶段逐步操作、每阶段的验证动作与常见偏差 |
| `references/knowledge-point-spec.md` | 知识点粒度、命名、主题簇、文件模板 |
| `references/prompts.md` | 可直接复制的精读 / 合并 / 撰写提示词全文 |
| `references/pitfalls.md` | 实战踩过的坑与处置办法 |

## 参考实现

本仓库不内置生成后的知识库产物；使用时把 `<out>` 指向你自己的输出目录。这套流程已在真实项目上验证过（178 本书 / 3,641 条划线 → 834 个知识点 / 11 个分类），可作为规模与输出形态的参考。
