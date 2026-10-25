#!/usr/bin/env node
// 把笔记语料切成「并行精读批次」
// 用法: node make-batches.mjs <notesDir> <outDir> [targetChars] [minItemsPerBatch]
//   notesDir  extract-notes.mjs 产出的 notes/（需含 _index.json）
//   outDir    输出批次目录
//   targetChars      每批目标字数，默认 12000
//   minItemsPerBatch 每批至少几本书，默认 2
//
// 产出: <outDir>/batch-NN.txt（每本书以 ===== BOOK n ===== 分隔）+ <outDir>/_manifest.json
//
// 说明: _index.json 已按字数降序排列，贪心装箱后最大批次约为 targetChars + 单本最大字数。

import fs from 'node:fs';
import path from 'node:path';

const [notesDir, outDir, targetArg, minArg] = process.argv.slice(2);
if (!notesDir || !outDir) {
  console.error('用法: node make-batches.mjs <notesDir> <outDir> [targetChars] [minItemsPerBatch]');
  process.exit(1);
}
const target = Number(targetArg || 12000);
const minItems = Number(minArg || 2);

const idxPath = path.join(notesDir, '_index.json');
if (!fs.existsSync(idxPath)) {
  console.error('找不到 ' + idxPath + '，请先跑 extract-notes.mjs');
  process.exit(1);
}
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (/^batch-\d+\.txt$/.test(f) || f === '_manifest.json') fs.unlinkSync(path.join(outDir, f));
}

const batches = [];
let cur = { items: [], chars: 0 };
for (const r of idx) {
  const c = r.chars + r.reviews * 80;
  if (cur.chars + c > target && cur.items.length >= minItems) {
    batches.push(cur);
    cur = { items: [], chars: 0 };
  }
  cur.items.push(r);
  cur.chars += c;
}
if (cur.items.length) batches.push(cur);

const manifest = [];
batches.forEach((b, i) => {
  const parts = ['共 ' + b.items.length + ' 本书的微信读书划线笔记如下。每本书以 "===== BOOK n =====" 分隔。\n'];
  b.items.forEach((r, k) => {
    parts.push('===== BOOK ' + (k + 1) + ' =====');
    parts.push(fs.readFileSync(path.join(notesDir, r.file), 'utf8'));
    parts.push('');
  });
  const name = 'batch-' + String(i + 1).padStart(2, '0') + '.txt';
  fs.writeFileSync(path.join(outDir, name), parts.join('\n'), 'utf8');
  manifest.push({
    batch: name,
    books: b.items.length,
    chars: b.chars,
    titles: b.items.map(r => r.title)
  });
});
fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('批次数: ' + batches.length + '（目标每批 ' + target + ' 字）');
for (const m of manifest) console.log('  ' + m.batch + '  ' + m.books + ' 本  ' + m.chars + ' 字  ' + m.titles.slice(0, 2).join(' / ') + (m.titles.length > 2 ? ' …' : ''));
const maxChars = Math.max(...manifest.map(m => m.chars));
console.log('\n最大批次 ' + maxChars + ' 字。若超过 30000，请调小 targetChars 重跑（单批过大时子 agent 容易漏读）。');
