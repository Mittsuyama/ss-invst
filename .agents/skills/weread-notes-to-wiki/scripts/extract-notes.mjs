#!/usr/bin/env node
// 微信读书导出笔记 → 可读文本语料
// 用法: node extract-notes.mjs <rawDir> <workDir>
//   rawDir  微信读书导出目录，需含 index.json 与 books/*.json
//   workDir 工作目录（会被创建），产出 notes/ 与 meta.json
//
// 产出:
//   <workDir>/notes/<bookId>__<title>.md   每本书一份可读划线笔记
//   <workDir>/notes/_index.json            全部书的索引（含划线数、想法数、字数、文件路径）
//   <workDir>/meta.json                    书目元数据 + 数据质量警告
//
// 退出码: 0 正常；1 参数错误或未解析到任何书

import fs from 'node:fs';
import path from 'node:path';

const [rawDir, workDir] = process.argv.slice(2);
if (!rawDir || !workDir) {
  console.error('用法: node extract-notes.mjs <rawDir> <workDir>');
  process.exit(1);
}
if (!fs.existsSync(rawDir)) {
  console.error('rawDir 不存在: ' + rawDir);
  process.exit(1);
}

const booksDir = path.join(rawDir, 'books');
if (!fs.existsSync(booksDir)) {
  console.error('找不到 books/ 目录: ' + booksDir);
  process.exit(1);
}

const notesDir = path.join(workDir, 'notes');
fs.mkdirSync(notesDir, { recursive: true });

const stripInvisible = s => s.replace(/[\u200b\u200c\u200d\ufeff]/g, '');
const safeName = s => stripInvisible(String(s || '')).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
const squash = s => String(s || '').replace(/\s+/g, ' ').trim();

const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.json'));
const index = [];
const warnings = [];

for (const f of files) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(booksDir, f), 'utf8'));
  } catch (e) {
    warnings.push({ level: 'error', file: f, msg: 'JSON 解析失败: ' + e.message });
    continue;
  }

  const ov = j.overview || {};
  const outer = (ov.book && ov.book.book) ? ov.book.book : (ov.book || {});
  const title = outer.title || j.title || f;
  const author = outer.author || j.author || '';

  // 划线：优先顶层 bookmarklist，兼容旧结构
  let marks = [];
  const bmRaw = (j.bookmarklist && j.bookmarklist.raw) || (ov.bookmarklist && ov.bookmarklist.raw);
  if (bmRaw) {
    try { marks = (JSON.parse(bmRaw).updated || []).filter(m => m && m.markText); }
    catch (e) { warnings.push({ level: 'warn', file: f, msg: 'bookmarklist 解析失败: ' + e.message }); }
  }

  // 想法（用户自己的批注）
  const reviews = [];
  for (const p of ((j.myReviews && j.myReviews.pages) || [])) {
    try {
      for (const rv of (JSON.parse(p.raw || '{}').reviews || [])) {
        if (rv.review && rv.review.content) reviews.push(rv.review.content);
      }
    } catch (e) { /* 单页失败不影响整体 */ }
  }

  // 按阅读顺序排（章节号优先，其次划线时间）
  marks.sort((a, b) => (a.chapterIdx ?? 0) - (b.chapterIdx ?? 0) || (a.createTime ?? 0) - (b.createTime ?? 0));

  const cats = (outer.categories || []).map(c => c.title).join('|');
  const lines = [];
  lines.push('# ' + title);
  lines.push('- 作者: ' + author + (outer.translator ? ' / 译者: ' + outer.translator : ''));
  lines.push('- 微信读书分类: ' + (cats || '未分类'));
  if (outer.publishTime) lines.push('- 出版时间: ' + outer.publishTime);
  lines.push('- 进度: ' + (ov.readingProgress ?? '?') + '%  划线: ' + marks.length + '  想法: ' + reviews.length);
  lines.push('');
  lines.push('## 划线笔记');
  for (const m of marks) lines.push('[' + (m.chapterIdx ?? '?') + '] ' + squash(m.markText));
  if (reviews.length) {
    lines.push('');
    lines.push('## 我的想法');
    for (const r of reviews) lines.push('- ' + squash(r));
  }

  const outName = j.bookId + '__' + safeName(title) + '.md';
  fs.writeFileSync(path.join(notesDir, outName), lines.join('\n'), 'utf8');

  if (marks.length === 0) warnings.push({ level: 'warn', file: f, msg: '0 条划线（无法产出任何知识点）: ' + title });

  index.push({
    file: outName,
    bookId: j.bookId,
    title,
    author,
    category: cats,
    marks: marks.length,
    reviews: reviews.length,
    chars: marks.map(m => m.markText).join('').length + reviews.join('').length
  });
}

// 同书多记录检测：同一书名出现多份笔记文件是后面「读到残本」的根因
const byTitle = new Map();
for (const r of index) {
  if (!byTitle.has(r.title)) byTitle.set(r.title, []);
  byTitle.get(r.title).push(r);
}
for (const [t, arr] of byTitle) {
  if (arr.length > 1) {
    warnings.push({
      level: 'warn',
      file: arr.map(a => a.file).join(' / '),
      msg: '同一书名有 ' + arr.length + ' 份笔记文件（划线数分别为 ' + arr.map(a => a.marks).join('/') + '），后续引用务必取划线最多的那份，否则会误判「无支撑」'
    });
  }
}

index.sort((a, b) => b.chars - a.chars);
fs.writeFileSync(path.join(notesDir, '_index.json'), JSON.stringify(index, null, 2), 'utf8');
fs.writeFileSync(path.join(workDir, 'meta.json'), JSON.stringify({
  source: rawDir,
  bookRecords: index.length,
  uniqueTitles: byTitle.size,
  totalMarks: index.reduce((s, r) => s + r.marks, 0),
  totalReviews: index.reduce((s, r) => s + r.reviews, 0),
  totalChars: index.reduce((s, r) => s + r.chars, 0),
  books: index,
  warnings
}, null, 2), 'utf8');

console.log('书目记录: ' + index.length + '（去重后 ' + byTitle.size + ' 部）');
console.log('划线总数: ' + index.reduce((s, r) => s + r.marks, 0) + '  想法: ' + index.reduce((s, r) => s + r.reviews, 0) + '  字数: ' + index.reduce((s, r) => s + r.chars, 0));
console.log('产出: ' + notesDir);
if (warnings.length) {
  console.log('\n数据质量警告 ' + warnings.length + ' 条:');
  for (const w of warnings) console.log('  [' + w.level + '] ' + w.msg);
}
if (index.length === 0) process.exit(1);
