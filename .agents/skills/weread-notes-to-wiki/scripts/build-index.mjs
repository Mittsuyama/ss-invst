#!/usr/bin/env node
// 由知识点清单生成三层渐进式披露目录
// 用法: node build-index.mjs <categories.json> <kpDir> <llmRoot> [workDir]
//   categories.json  [{ "slug": "financial-statements", "zh": "财报分析与舞弊识别", "desc": "…" }]
//   kpDir            <slug>.json 知识点清单（合并阶段的产出）
//   llmRoot          输出根目录；会写 <llmRoot>/llms.txt 与 <llmRoot>/<slug>/llms.txt
//   workDir          可选。若含 notes/_index.json 与 book-category.json，根目录会带上书数/划线数统计
//
// 产出:
//   <llmRoot>/llms.txt                一级目录：分类名 + 描述 + 分类 llms.txt 地址
//   <llmRoot>/<slug>/llms.txt         二级目录：按主题簇分组的知识点名 + 描述 + txt 地址

import fs from 'node:fs';
import path from 'node:path';

const [catsFile, kpDir, llmRoot, workDir] = process.argv.slice(2);
if (!catsFile || !kpDir || !llmRoot) {
  console.error('用法: node build-index.mjs <categories.json> <kpDir> <llmRoot> [workDir]');
  process.exit(1);
}
for (const [label, p] of [['categories.json', catsFile], ['kpDir', kpDir]]) {
  if (!fs.existsSync(p)) {
    console.error('找不到 ' + label + ': ' + p);
    console.error('用法: node build-index.mjs <categories.json> <kpDir> <llmRoot> [workDir]');
    process.exit(1);
  }
}
const cats = JSON.parse(fs.readFileSync(catsFile, 'utf8'));

// 可选的书籍/划线统计
let bookStats = null;
let corpus = null;
if (workDir) {
  const idxPath = path.join(workDir, 'notes', '_index.json');
  // book-category.json 可能和历史语料放在一起，也可能和知识点清单一放在一起，两处都找
  const mapPath = [path.join(workDir, 'book-category.json'), path.join(kpDir, 'book-category.json')]
    .find(p => fs.existsSync(p));
  if (fs.existsSync(idxPath) && mapPath) {
    const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    // 同一书名可能有多份记录，取划线最多的那份
    const marksByTitle = new Map();
    for (const r of idx) marksByTitle.set(r.title, Math.max(marksByTitle.get(r.title) || 0, r.marks));
    bookStats = {};
    for (const [title, slug] of Object.entries(map)) {
      if (!bookStats[slug]) bookStats[slug] = { books: 0, marks: 0 };
      bookStats[slug].books++;
      bookStats[slug].marks += marksByTitle.get(title) || 0;
    }
    // 语料真值（按导出记录数，不做去重）
    corpus = {
      records: idx.length,
      uniqueTitles: new Set(idx.map(r => r.title)).size,
      marks: idx.reduce((s, r) => s + r.marks, 0)
    };
  }
}

const rows = [];
for (const c of cats) {
  const kpPath = path.join(kpDir, c.slug + '.json');
  const dir = path.join(llmRoot, c.slug);
  let kps = 0, clusters = 0, built = false;
  if (fs.existsSync(kpPath)) {
    const kp = JSON.parse(fs.readFileSync(kpPath, 'utf8'));
    kps = kp.knowledge_points.length;
    clusters = kp.clusters.length;

    const order = kp.clusters.map(x => x.name);
    const grouped = new Map(order.map(n => [n, []]));
    for (const k of kp.knowledge_points) {
      if (!grouped.has(k.cluster)) grouped.set(k.cluster, []);
      grouped.get(k.cluster).push(k);
    }

    const lines = [];
    lines.push('# ' + (kp.category_zh || c.zh));
    lines.push('');
    if (c.desc) { lines.push('> ' + c.desc); lines.push(''); }
    lines.push('本分类共 ' + kps + ' 个知识点，分为 ' + clusters + ' 个主题簇。');
    lines.push('');
    for (const name of order) {
      const items = grouped.get(name) || [];
      if (!items.length) continue;
      const meta = kp.clusters.find(x => x.name === name);
      lines.push('## ' + name);
      lines.push('');
      if (meta && meta.desc) { lines.push(meta.desc); lines.push(''); }
      for (const k of items) lines.push('- [' + k.zh + '](' + k.slug + '.txt): ' + k.desc);
      lines.push('');
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'llms.txt'), lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
    built = true;
  }
  const st = bookStats && bookStats[c.slug] ? bookStats[c.slug] : null;
  rows.push({ ...c, kps, clusters, built, books: st ? st.books : null, marks: st ? st.marks : null });
}

// 根目录
const totalKps = rows.reduce((s, r) => s + r.kps, 0);
const totalBooks = rows.reduce((s, r) => s + (r.books || 0), 0);
const totalMarks = rows.reduce((s, r) => s + (r.marks || 0), 0);
const builtCount = rows.filter(r => r.built).length;

const out = [];
out.push('# 微信读书投资知识库');
out.push('');
const stat = totalKps ? '，归纳为 ' + totalKps + ' 个知识点' : '';
const cover = corpus
  ? corpus.records + ' 本' + (corpus.uniqueTitles !== corpus.records ? '（去重后 ' + corpus.uniqueTitles + ' 部）' : '') + '、' + corpus.marks.toLocaleString('en-US') + ' 条划线'
  : (totalBooks ? totalBooks + ' 部、' + totalMarks.toLocaleString('en-US') + ' 条划线' : '若干本书');
out.push('> 由微信读书划线笔记整理成的渐进式披露知识库：' + cover + stat + '。');
out.push('');
out.push('用法：先在本文件里选定分类 → 读该分类目录下的 `llms.txt` 定位知识点 → 读具体知识点 txt。每层只读需要的那一层，不必一次加载全部。');
out.push('');
out.push('当前进度：' + builtCount + ' / ' + rows.length + ' 个分类已生成知识点文件。');
out.push('');
out.push('## 分类');
out.push('');
for (const r of rows) {
  const detail = r.built
    ? ' 覆盖 ' + (r.books !== null ? r.books + ' 本书 / ' + r.marks + ' 条划线 / ' : '') + r.kps + ' 个知识点（' + r.clusters + ' 个主题簇）。'
    : '（知识点文件待生成）';
  out.push('- [' + r.zh + '](' + r.slug + '/llms.txt): ' + r.desc + detail);
}
out.push('');
out.push('## 约定');
out.push('');
out.push('- 每个知识点一个 txt 文件，文件名是英文 kebab-case slug，正文用中文。');
out.push('- 知识点文件的结构：`判断`（一句话结论）→ `要点` → `边界与反例` → `原文锚点`（划线原文，逐字保留）。');
out.push('- 头部字段：`分类`、`主题簇`、`相关`（同分类内其他知识点 slug）、`来源`（书名与划线数）、`证据`（几本书互证）。');
out.push('- 所有内容都来自原始划线笔记，没有外部补充。证据只有一本书的会标 `单书孤证`。');

fs.writeFileSync(path.join(llmRoot, 'llms.txt'), out.join('\n') + '\n', 'utf8');

console.log('根目录: ' + path.join(llmRoot, 'llms.txt'));
for (const r of rows) {
  console.log('  ' + (r.built ? '[x]' : '[ ]') + ' ' + r.slug.padEnd(22) + r.kps + ' 知识点 / ' + r.clusters + ' 簇' + (r.books !== null ? ' / ' + r.books + ' 本 / ' + r.marks + ' 划线' : ''));
}
