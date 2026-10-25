#!/usr/bin/env node
// 全库一致性校验（不含引文，引文用 verify-quotes.mjs）
// 用法: node verify-notes.mjs <categories.json> <kpDir> <llmRoot>
//
// A 落盘完整性  知识点清单 vs 实际 txt 文件，缺/多逐个列出
// B 结构一致性  slug 唯一且 kebab、cluster 引用有效、无空簇、中文名 ≤20 字
// C 相关引用    每个「相关:」token 都能解析到本分类内的 slug（自动识别中文名与全角顿号）
// D 跨分类冲突  同一 slug 出现在多个分类（会污染交叉引用）
//
// 退出码: 0 全绿；1 有问题

import fs from 'node:fs';
import path from 'node:path';

const [catsFile, kpDir, llmRoot] = process.argv.slice(2);
if (!catsFile || !kpDir || !llmRoot) {
  console.error('用法: node verify-notes.mjs <categories.json> <kpDir> <llmRoot>');
  process.exit(1);
}
for (const [label, p] of [['categories.json', catsFile], ['kpDir', kpDir], ['llmRoot', llmRoot]]) {
  if (!fs.existsSync(p)) {
    console.error('找不到 ' + label + ': ' + p);
    console.error('用法: node verify-notes.mjs <categories.json> <kpDir> <llmRoot>');
    process.exit(1);
  }
}
const cats = JSON.parse(fs.readFileSync(catsFile, 'utf8'));

const filesIn = dir => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => f.endsWith('.txt') && f !== 'llms.txt').map(f => f.replace(/\.txt$/, ''))
  : [];

const slugOwner = new Map();
let problems = 0, totalKp = 0, totalFiles = 0;

console.log('=== A/B 落盘完整性与结构一致性 ===');
for (const c of cats) {
  const kpPath = path.join(kpDir, c.slug + '.json');
  if (!fs.existsSync(kpPath)) { console.log('[' + c.slug + '] ⚠ 缺知识点清单 ' + kpPath); problems++; continue; }
  const j = JSON.parse(fs.readFileSync(kpPath, 'utf8'));
  const want = j.knowledge_points.map(k => k.slug);
  const have = filesIn(path.join(llmRoot, c.slug));
  const wantSet = new Set(want), haveSet = new Set(have);
  const missing = want.filter(s => !haveSet.has(s));
  const extra = have.filter(s => !wantSet.has(s));

  const issues = [];
  const dup = [...new Set(want.filter((s, i) => want.indexOf(s) !== i))];
  if (dup.length) issues.push('清单内 slug 重复: ' + dup.join(', '));
  const badSlug = j.knowledge_points.filter(k => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(k.slug)).map(k => k.slug);
  if (badSlug.length) issues.push('slug 非 kebab-case: ' + badSlug.join(', '));
  const longZh = j.knowledge_points.filter(k => k.zh.length > 20).map(k => k.slug + '(' + k.zh.length + '字)');
  if (longZh.length) issues.push('中文名超 20 字: ' + longZh.join(', '));
  const names = new Set(j.clusters.map(x => x.name));
  const orphan = j.knowledge_points.filter(k => !names.has(k.cluster)).map(k => k.slug + '→' + k.cluster);
  if (orphan.length) issues.push('游离知识点(簇名不存在): ' + orphan.join(', '));
  const emptyCluster = j.clusters.filter(x => !j.knowledge_points.some(k => k.cluster === x.name)).map(x => x.name);
  if (emptyCluster.length) issues.push('空簇: ' + emptyCluster.join(', '));
  if (missing.length) issues.push('缺文件 ' + missing.length + ' 个: ' + missing.join(', '));
  if (extra.length) issues.push('多余文件 ' + extra.length + ' 个: ' + extra.join(', '));

  totalKp += want.length;
  totalFiles += have.length;
  for (const s of want) {
    if (!slugOwner.has(s)) slugOwner.set(s, []);
    slugOwner.get(s).push(c.slug);
  }

  problems += issues.length;
  console.log('[' + c.slug.padEnd(22) + '] 应有 ' + String(want.length).padStart(3) + ' / 实有 ' + String(have.length).padStart(3) + (issues.length ? '  ⚠ ' + issues.join(' | ') : '  ✓'));
}

console.log('\n=== C 相关引用完整性 ===');
let refProblems = 0, refs = 0;
for (const c of cats) {
  const kpPath = path.join(kpDir, c.slug + '.json');
  if (!fs.existsSync(kpPath)) continue;
  const j = JSON.parse(fs.readFileSync(kpPath, 'utf8'));
  const valid = new Set(j.knowledge_points.map(k => k.slug));
  const zh2slug = new Map(j.knowledge_points.map(k => [k.zh, k.slug]));
  const dir = path.join(llmRoot, c.slug);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt') && x !== 'llms.txt')) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = t.match(/^相关: (.*)$/m);
    if (!m) continue;
    const raw = m[1].trim();
    if (raw === '无') continue;
    for (let tok of raw.split(/[,，、]/).map(s => s.trim()).filter(Boolean)) {
      refs++;
      tok = tok.replace(/[（(].*?[)）]/g, '').trim();
      if (valid.has(tok)) continue;
      const hint = zh2slug.has(tok) ? '（这是中文名，应写成 slug: ' + zh2slug.get(tok) + '）' : '（本分类无此 slug）';
      console.log('  ✗ ' + c.slug + '/' + f + ' → ' + tok + ' ' + hint);
      refProblems++;
    }
  }
}
problems += refProblems;
console.log(refProblems ? '  ' + refProblems + ' 条悬空引用' : '  ' + refs + ' 条引用全部可解析 ✓');

console.log('\n=== D 跨分类 slug 冲突 ===');
let conflicts = 0;
for (const [s, owners] of slugOwner) {
  if (owners.length > 1) { console.log('  ✗ ' + s + ' 同时属于: ' + owners.join(', ')); conflicts++; }
}
problems += conflicts;
console.log(conflicts ? '  ' + conflicts + ' 个冲突 slug（建议给其中一个加语义前缀）' : '  无冲突 ✓');

console.log('\n合计: ' + totalKp + ' 个知识点 / ' + totalFiles + ' 个文件 / ' + (problems ? problems + ' 个问题' : '全部通过 ✓'));
if (problems) process.exit(1);
