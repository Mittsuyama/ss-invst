import fs from 'node:fs';
import path from 'node:path';
import { skillRootDir } from './skill-paths';

export interface SkillParam {
  key: string;
  desc: string;
}

/** 索引条目（供 LLM 自动路由 / UI 手动选择） */
export interface SkillInfo {
  name: string;
  description: string;
  params?: SkillParam[];
  rootDir: string;
}

/** 加载后的完整 skill 包 */
export interface SkillPackage extends SkillInfo {
  markdown: string;
}

let cachedIndex: SkillInfo[] | null = null;
const packageCache = new Map<string, SkillPackage>();

/** 去掉首尾引号/空白 */
function unquote(s: string): string {
  return s.trim().replace(/^["']/, '').replace(/["']$/, '').trim();
}

/**
 * 极简 YAML frontmatter 解析：只取 name / description / params（- key/desc 对）。
 * 解析失败返回 null，由调用方跳过该 skill，绝不影响启动。
 */
function parseFrontmatter(
  md: string,
): { name?: string; description?: string; params?: SkillParam[] } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return null;
  const body = m[1];

  const out: { name?: string; description?: string; params?: SkillParam[] } = {};

  const nameM = /^name:\s*(.+)$/m.exec(body);
  if (nameM) out.name = unquote(nameM[1]);

  const descM = /^description:\s*(.+)$/m.exec(body);
  if (descM) out.description = unquote(descM[1]);

  // 解析 `- key: x` 后跟 `desc: y` 的参数块
  const params: SkillParam[] = [];
  const itemRe = /-\s*key:\s*([^\r\n]+)[\s\S]*?\bdesc:\s*([^\r\n]+)/g;
  let pm: RegExpExecArray | null;
  while ((pm = itemRe.exec(body)) !== null) {
    params.push({ key: unquote(pm[1]), desc: unquote(pm[2]) });
  }
  if (params.length) out.params = params;

  return out;
}

/** 扫描 skill 根目录，解析每个子目录的 SKILL.md */
export function scanSkills(): SkillInfo[] {
  if (cachedIndex) return cachedIndex;

  const root = skillRootDir();
  const infos: SkillInfo[] = [];
  if (!fs.existsSync(root)) return (cachedIndex = []);

  for (const name of fs.readdirSync(root)) {
    const rootDir = path.join(root, name);
    const mdPath = path.join(rootDir, 'SKILL.md');
    try {
      if (!fs.statSync(rootDir).isDirectory()) continue;
      if (!fs.existsSync(mdPath)) continue;
      const md = fs.readFileSync(mdPath, 'utf-8');
      const fm = parseFrontmatter(md);
      if (!fm?.name) continue;
      infos.push({
        name: fm.name,
        description: fm.description ?? '',
        params: fm.params,
        rootDir,
      });
    } catch {
      // 单个 skill 损坏/缺失：跳过，不影响其它
    }
  }

  cachedIndex = infos;
  return infos;
}

/** 索引（不含 markdown），供 list_skills 工具与 UI 使用 */
export function listSkills(): SkillInfo[] {
  return scanSkills();
}

/** 按名加载 skill 包（含 SKILL.md 全文） */
export function loadSkill(name: string): SkillPackage | undefined {
  const cached = packageCache.get(name);
  if (cached) return cached;

  const info = scanSkills().find((s) => s.name === name);
  if (!info) return undefined;

  const mdPath = path.join(info.rootDir, 'SKILL.md');
  const markdown = fs.readFileSync(mdPath, 'utf-8');
  const pkg: SkillPackage = { ...info, markdown };
  packageCache.set(name, pkg);
  return pkg;
}

/** 解析 skill 内相对路径，并保证结果不越出 skill 根目录 */
export function resolveSkillPath(name: string, rel: string): string | undefined {
  const info = scanSkills().find((s) => s.name === name);
  if (!info) return undefined;
  const resolved = path.resolve(info.rootDir, rel);
  const base = info.rootDir.endsWith(path.sep) ? info.rootDir : info.rootDir + path.sep;
  if (resolved !== info.rootDir && !resolved.startsWith(base)) return undefined;
  return resolved;
}

/** 供测试/重置用 */
export function resetSkillCache(): void {
  cachedIndex = null;
  packageCache.clear();
}
