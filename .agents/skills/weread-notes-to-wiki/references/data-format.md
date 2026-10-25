# 微信读书导出结构

## 目录形态

```
<rawDir>/
├─ index.json          书目索引：每本书的元数据 + noteCount 等统计
└─ books/
   ├─ 908872.json      一本书一个文件，含完整划线列表
   ├─ CB_7tdAlBAkbFr96vr6xL08CDmh.json
   └─ …
```

`index.json` 顶层字段：`books[]`（有时也直接是数组）、`fetchedBookCount`、`failedBooks[]`、`summary`。
`summary` 里的 `highlightTotal` / `reviewTotal` 可以用来核对解析结果——`extract-notes.mjs` 输出的划线总数必须与它一致。

## 单本书 JSON 的结构

```jsonc
{
  "bookId": "908872",
  "title": "以交易为生（原书第2版）",
  "author": "亚历山大·埃尔德",
  "overview": {
    "bookId": "908872",
    "book": {                      // ← 注意这一层
      "bookId": "908872",
      "title": "…", "author": "…", "translator": "…",
      "categories": [{ "title": "经济理财-财经" }],   // 微信读书官方分类
      "publishTime": "2017-07-01 00:00:00"
    },
    "readingProgress": 19,
    "noteCount": 16,
    "markedStatus": 2,
    "sort": 1786286450
  },
  "bookmarklist": {
    "raw": "{\"synckey\":…,\"updated\":[ { \"markText\": \"…\", \"chapterIdx\": 20, \"createTime\": … }, … ]}"
  },
  "myReviews": {
    "pages": [ { "page": 1, "raw": "{\"totalCount\":0,\"reviews\":[…],…}" } ]
  },
  "errors": []
}
```

三个容易踩的点：

1. **`bookmarklist.raw` 与 `myReviews.pages[].raw` 是「字符串套 JSON」**，需要二次 `JSON.parse`。外层解析成功不代表内层能解析，两处都要 try/catch。
2. **`categories` 在 `overview.book`（或部分导出里在 `overview.book.book`）下**，不在顶层。两处都试一遍。
3. **`myReviews` 是用户自己的批注**，信息密度比划线高得多（划线是作者的话，想法是读者的判断）。撰写知识点时：「判断」句优先由划线支撑，「要点」可以参考想法，但 `原文锚点` 只能引用划线原文。

`extract-notes.mjs` 已经把这三处坑都处理掉了。**不要手写解析**，直接用脚本。

## 同书多记录陷阱（最容易导致误判）

同一本书在 `books/` 里可能存在**两个文件**，因为读者换了阅读端或重新导入过，导出时就成了两条记录——其中一条可能只同步到 1 条划线。

真实案例：

| 书名 | 文件 A | 文件 B |
|---|---|---|
| 手把手教你读财报2——18节课看透银行业 | `CB_A1FCLlCLZ9wm6cK6cm__…md`（9 条划线） | `CB_DnQ7P27RPFz36j76l0A642Ul__…md`（1 条划线，且是断句残片） |
| UsaVsUsa | `CB_9kf5M95MOFWW6vs6xLCYn7iO__…md`（3 条划线） | `CB_7tdAlBAkbFr96vr6xL08CDmh__…md`（1 条划线） |

**后果**：如果候选知识点的 `note_files` 指向了残本，撰写 agent 会诚实地报告「笔记里没有支撑」，于是知识点被跳过或判 DROP——但实际上完整材料就在隔壁文件里。真实事故中，这直接导致 5 个知识点被误删、3 个文件被写成空壳。

**处置**：
- `extract-notes.mjs` 会在 `meta.json` 的 `warnings` 里明确列出「同一书名有 N 份笔记文件」及各自划线数。**阶段 1 必须读完这些警告。**
- 建「书 → 分类」映射时，`marksByTitle` 取**同一书名的最大划线数**（`build-index.mjs` 已这么做）。
- 候选的 `note_files` 若指向残本，撰写前先按**书名**（而不是文件名）在 `notes/` 里找同名文件，或直接对全书主干做 grep。
- 判断某知识点「无支撑」之前，必须确认已经把该书**所有**笔记文件都读过了。这是 DROP 决策的前置条件。

## 零划线书

会有几本书 `noteCount = 0`（用户只是加入书架或刚开始读）。`extract-notes.mjs` 会为它们生成一个只有头部、没有划线段的 md，并在 warnings 里标出。

这类书要有登记但不产出知识点。不要因为「书名看起来很重要」就为它造知识点——那正是空壳的来源。
