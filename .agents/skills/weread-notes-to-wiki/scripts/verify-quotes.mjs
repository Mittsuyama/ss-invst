#!/usr/bin/env node
// 引文忠实性校验（本流水线的核心质量闸门）
// 用法: node verify-quotes.mjs <notesDir> <llmRoot>
//
// 把每个知识点文件里 `- 《书名》：「原句」` 的「原句」抽出来，回查它是否**逐字连续**出现在
// 原始划线语料中。任何一处命中失败都说明子 agent 改写了原文（偷删标点、改字、用「……」
// 拼接不相连的两句），必须逐条修回原文。
//
// 退出码: 0 全部逐字命中；1 有失配

import fs from 'node:fs';
import path from 'node:path';

const [notesDir, llmRoot] = process.argv.slice(2);
if (!notesDir || !llmRoot) {
  console.error('用法: node verify-quotes.mjs <notesDir> <llmRoot>');
  process.exit(1);
}

for (const [label, p] of [['notesDir', notesDir], ['llmRoot', llmRoot]]) {
  if (!fs.existsSync(p)) {
    console.error('找不到 ' + label + ': ' + p);
    console.error('用法: node verify-quotes.mjs <notesDir> <llmRoot>');
    process.exit(1);
  }
}

const strip = s => s.replace(/[\u200b\u200c\u200d\ufeff]/g, '');
const notes = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'))
  .map(f => strip(fs.readFileSync(path.join(notesDir, f), 'utf8')));
const blob = notes.join('\n');

let total = 0, miss = 0;
const problems = [];
for (const cat of fs.readdirSync(llmRoot)) {
  const dir = path.join(llmRoot, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt') && x !== 'llms.txt')) {
    const text = strip(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const m of text.matchAll(/^- 《.+?》：「(.+)」$/gm)) {
      const q = m[1].trim();
      total++;
      if (!blob.includes(q)) { miss++; problems.push(cat + '/' + f + ' :: ' + q.slice(0, 60)); }
    }
  }
}
console.log('原文锚点总数=' + total + ' 无法在笔记语料中逐字命中=' + miss);
if (miss) {
  console.log('\n失配清单（逐条回原文修正，不许保留改写）:');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('✓ 全部引文逐字忠实于原始划线');
