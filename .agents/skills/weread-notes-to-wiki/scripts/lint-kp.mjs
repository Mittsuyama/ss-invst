#!/usr/bin/env node
// 知识点文件版式检查 + 自动修正
// 用法: node lint-kp.mjs <categoryDir> [--check]
//   categoryDir  某个分类目录，如 <out>/<category>
//   --check      只检查不写盘
//
// 自动修正:
//   1. 行内粘连的小节标题（`…内容。## 边界与反例`）切开，并保证标题前后有空行
//   2. H1 统一为 `# 中文名 slug`（子 agent 经常漏写 slug）
// 检查项: 头部 5 个字段、四个小节齐全、空壳标记、正文过短
//
// 退出码: 0 无问题；1 存在问题

import fs from 'node:fs';
import path from 'node:path';

const [dir, ...flags] = process.argv.slice(2);
if (!dir) {
  console.error('用法: node lint-kp.mjs <categoryDir> [--check]');
  process.exit(1);
}
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('找不到分类目录: ' + dir);
  console.error('用法: node lint-kp.mjs <categoryDir> [--check]');
  process.exit(1);
}
const dryRun = flags.includes('--check');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && f !== 'llms.txt').sort();
const problems = [];
let fixedTitle = 0, fixedLayout = 0;

for (const f of files) {
  const p = path.join(dir, f);
  const slug = f.replace(/\.txt$/, '');
  const original = fs.readFileSync(p, 'utf8');
  let text = original;

  // 修正 1: 粘连标题切开 + 标题前后空行
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    const glued = l.search(/(?<!^)\s*## /);
    if (glued > 0) {
      const head = l.slice(0, glued).trimEnd();
      if (head) out.push(head);
      l = l.slice(l.indexOf('## ', glued));
    }
    if (/^## /.test(l)) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(l.trimEnd());
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== '' && !/^## /.test(next)) out.push('');
      continue;
    }
    out.push(l);
  }
  text = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

  // 修正 2: H1 统一为 `# 中文名 slug`
  const ls = text.split('\n');
  const h1 = ls[0] || '';
  if (h1.startsWith('# ')) {
    const body = h1.slice(2).trim();
    if (!body.endsWith(slug)) {
      ls[0] = '# ' + body.replace(/\s+[a-z0-9-]+$/, '') + ' ' + slug;
      text = ls.join('\n');
      fixedTitle++;
    }
  } else {
    problems.push([f, '首行不是 H1: ' + h1.slice(0, 40)]);
  }

  if (text !== original) {
    if (!dryRun) fs.writeFileSync(p, text, 'utf8');
    if (text.replace(/^# .*\n/, '') !== original.replace(/^# .*\n/, '')) fixedLayout++;
  }

  // 校验（基于修正后的文本）
  const fin = text.split('\n');
  for (const key of ['分类:', '主题簇:', '相关:', '来源:', '证据:']) {
    if (!fin.slice(0, 8).some(l => l.includes(key))) problems.push([f, '缺少头部字段 ' + key]);
  }
  for (const sec of ['## 判断', '## 要点', '## 边界与反例', '## 原文锚点']) {
    if (!fin.some(l => l.trim() === sec)) problems.push([f, '缺少小节 ' + sec]);
  }
  if (/笔记中未记录可支撑本知识点的实质内容/.test(text)) problems.push([f, '空壳']);
  const body = text.split('\n').slice(6).join('').replace(/\s/g, '');
  if (body.length < 120) problems.push([f, '正文过短 (' + body.length + ' 字)']);
}

console.log(path.basename(dir) + ': 文件=' + files.length + ' 标题规范化=' + fixedTitle + ' 版式修正=' + fixedLayout + ' 问题=' + problems.length);
for (const [f, m] of problems) console.log('  [' + f + '] ' + m);
if (problems.length) process.exit(1);
