#!/usr/bin/env node
// 三层渐进式披露目录的链接自洽校验
// 用法: node verify-links.mjs <llmRoot>
//
// 校验:
//   1. 根 llms.txt 里每个分类链接都指向存在的 <slug>/llms.txt
//   2. 每个分类 llms.txt 里每条知识点链接都指向存在的 txt
//   3. 索引条数 == 目录内实际 txt 数（防止漏写/多写目录项）
//
// 退出码: 0 全部自洽；1 有失效链接

import fs from 'node:fs';
import path from 'node:path';

const [llmRoot] = process.argv.slice(2);
if (!llmRoot) {
  console.error('用法: node verify-links.mjs <llmRoot>');
  process.exit(1);
}

let bad = 0, links = 0;
const rootPath = path.join(llmRoot, 'llms.txt');
if (!fs.existsSync(rootPath)) {
  console.error('找不到 ' + rootPath);
  process.exit(1);
}

console.log('=== 一级目录 → 分类 ===');
for (const m of fs.readFileSync(rootPath, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
  links++;
  if (!fs.existsSync(path.join(llmRoot, m[1]))) { console.log('  ✗ 失效: ' + m[1]); bad++; }
}
if (!bad) console.log('  全部分类链接有效 ✓');

console.log('=== 二级目录 → 知识点 ===');
let totalKpLinks = 0;
for (const cat of fs.readdirSync(llmRoot)) {
  const dir = path.join(llmRoot, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  const idx = path.join(dir, 'llms.txt');
  if (!fs.existsSync(idx)) { console.log('  ✗ ' + cat + ' 缺少 llms.txt'); bad++; continue; }
  let n = 0, localBad = 0;
  for (const m of fs.readFileSync(idx, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    links++; n++;
    if (!fs.existsSync(path.join(dir, m[1]))) { console.log('  ✗ ' + cat + '/llms.txt 失效: ' + m[1]); bad++; localBad++; }
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && f !== 'llms.txt').length;
  if (n !== files) { console.log('  ✗ ' + cat + ': 索引 ' + n + ' 条 vs 实际 ' + files + ' 个文件'); bad++; }
  else if (!localBad) console.log('  ✓ ' + cat.padEnd(22) + n + ' 个知识点');
  totalKpLinks += n;
}

console.log('\n链接总数=' + links + '（分类 ' + (links - totalKpLinks) + ' + 知识点 ' + totalKpLinks + '）  失效=' + bad);
if (bad) process.exit(1);
console.log('✓ 三层结构完全自洽');
