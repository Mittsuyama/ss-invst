# weread-notes-to-wiki

把微信读书导出的划线笔记，变成一套**渐进式披露**的知识库。

```
<out>/llms.txt                  一级目录：分类名 + 描述 + 分类目录地址
<out>/<category>/llms.txt       二级目录：主题簇 → 知识点名 + 描述 + txt 地址
<out>/<category>/<slug>.txt     知识点正文：判断 / 要点 / 边界与反例 / 原文锚点
```

读取方每层只加载需要的那一层。适合把「一堆书的读书笔记」变成 LLM 可检索、人可浏览的知识资产。

## 目录

```
SKILL.md                          入口：何时用、六阶段大纲、5 条硬性规则、完成判据
README.md                         本文件
references/
  data-format.md                  微信读书导出结构、字段、同书多记录陷阱
  pipeline.md                     六阶段逐步操作手册
  knowledge-point-spec.md         知识点粒度、命名、簇、文件模板、llms.txt 格式
  prompts.md                      可复制的精读 / 合并 / 撰写 / 补写提示词
  pitfalls.md                     实战踩坑记录（16 条）
scripts/                          零依赖 Node，路径全走 CLI 参数
  extract-notes.mjs               导出 JSON → 每本书可读文本 + 索引 + 数据质量警告
  make-batches.mjs                切并行精读批次
  build-index.mjs                 生成分类 llms.txt + 根 llms.txt
  lint-kp.mjs                     版式检查并自动修
  verify-notes.mjs                完整性 + 结构 + 相关引用 + 跨分类冲突
  verify-quotes.mjs               引文逐字回查（核心质量闸门）
  verify-links.mjs                三层目录链接自洽
```

## 快速跑一遍

```bash
S=.agents/skills/weread-notes-to-wiki/scripts

# 1 解析
node $S/extract-notes.mjs <rawDir> <work>          # 读完输出的 warnings 再往下

# 2 切批（然后用 workflow 并行精读，提示词见 references/prompts.md）
node $S/make-batches.mjs <work>/notes <work>/batches 12000 2

# 3 父分类 → 交给用户确认（硬门禁）

# 4 合并 → <work>/kp/<category>.json
# 5 撰写 → <out>/<category>/<slug>.txt

# 6 校验
node $S/lint-kp.mjs        <out>/<category> --check
node $S/verify-notes.mjs   categories.json <work>/kp <out>
node $S/verify-quotes.mjs  <work>/notes <out>
node $S/build-index.mjs    categories.json <work>/kp <out> <work>
node $S/verify-links.mjs   <out>
```

## 这套流程真正解决的问题

LLM 写「知识总结」的最大风险不是写得差，而是**写得像真的**——把模型自己的领域知识混进读书笔记，把原文改成通顺版本，然后整库失去可信度。

所以这里的核心不是提示词技巧，而是**两道机器闸门**：

1. `verify-quotes.mjs` 把每一条 `原文锚点` 拿回原始笔记里做逐字子串匹配，一处不中就报错。真实项目里它抓到了 4 处无意改写。
2. `verify-notes.mjs` 保证「知识点清单 = 磁盘文件」，并且每条 `相关` 引用都能解析。

配上「找不到支撑就跳过、绝不留空壳」这条规则，产出才敢标 `单书孤证` / `N 本书互证`。

## 参考实现

本仓库不内置生成后的知识库产物；使用时把 `<out>` 指向你自己的输出目录。这套流程已在真实项目上验证过：178 本书 / 3,641 条划线 → 11 个分类 / 834 个知识点 / 1,576 条引文全部逐字校验通过。
