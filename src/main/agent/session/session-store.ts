import fs from 'node:fs';
import path from 'node:path';
import type {
  SessionFileInfo,
  SessionFileList,
  SessionMeta,
  SessionSnapshot,
  TodoItem,
} from '@shared/types/session';
import type { KeyMoveEntry } from '@shared/types/key-move';

/** workspace 下的隐藏目录名 */
const ROOT_DIR = '.ss-invst';

let idSeq = 0;
/** 生成会话 id（本地文件命名，无需加密随机） */
function genSessionId(): string {
  idSeq += 1;
  return `${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sessionsDir(workspacePath: string): string {
  return path.join(workspacePath, ROOT_DIR, 'sessions');
}
function sessionDir(workspacePath: string, id: string): string {
  return path.join(sessionsDir(workspacePath), id);
}
function metaPath(workspacePath: string, id: string): string {
  return path.join(sessionDir(workspacePath, id), 'meta.json');
}
function jsonlPath(workspacePath: string, id: string): string {
  return path.join(sessionDir(workspacePath, id), 'messages.jsonl');
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

/** 原子写：先写临时文件再 rename，避免写一半损坏 */
function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

/** 从会话消息里取第一条 user 文本，截断为标题 */
export function deriveTitle(messages: unknown[]): string {
  for (const m of messages) {
    const msg = m as { role?: string; content?: unknown };
    if (msg?.role !== 'user') continue;
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b?.type === 'text' && typeof b?.text === 'string')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join('');
    }
    const t = text.replace(/\s+/g, ' ').trim();
    if (t) return t.length > 30 ? `${t.slice(0, 30)}…` : t;
  }
  return '新会话';
}

export function createSession(workspacePath: string): SessionMeta {
  const id = genSessionId();
  ensureDir(sessionDir(workspacePath, id));
  const now = Date.now();
  const meta: SessionMeta = {
    id,
    title: '新会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  writeJsonAtomic(metaPath(workspacePath, id), meta);
  fs.writeFileSync(jsonlPath(workspacePath, id), '', 'utf-8');
  return meta;
}

export function listSessions(workspacePath: string): SessionMeta[] {
  const dir = sessionsDir(workspacePath);
  if (!fs.existsSync(dir)) return [];
  const metas: SessionMeta[] = [];
  for (const name of fs.readdirSync(dir)) {
    try {
      const meta = JSON.parse(
        fs.readFileSync(path.join(dir, name, 'meta.json'), 'utf-8'),
      ) as SessionMeta;
      if (meta && typeof meta.id === 'string') metas.push(meta);
    } catch {
      // 跳过损坏/非会话目录
    }
  }
  metas.sort((a, b) => b.updatedAt - a.updatedAt);
  return metas;
}

export function loadSession(workspacePath: string, id: string): SessionSnapshot {
  const meta = JSON.parse(fs.readFileSync(metaPath(workspacePath, id), 'utf-8')) as SessionMeta;
  const jl = jsonlPath(workspacePath, id);
  const messages: unknown[] = [];
  if (fs.existsSync(jl)) {
    const content = fs.readFileSync(jl, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        messages.push(JSON.parse(t));
      } catch {
        // 丢弃崩溃残留的尾部不完整行
      }
    }
  }
  return { meta, messages, keyMoves: readKeyMoves(workspacePath, id) };
}

/**
 * 追加保存自 savedCount 之后的消息，并更新 meta（含自动标题）。
 * 返回更新后的 meta 与新计数。
 */
export function saveSession(
  workspacePath: string,
  id: string,
  messages: unknown[],
  savedCount: number,
): { meta: SessionMeta; savedCount: number } {
  ensureDir(sessionDir(workspacePath, id));
  const jl = jsonlPath(workspacePath, id);
  const pending = messages.slice(savedCount);
  if (pending.length) {
    fs.appendFileSync(jl, pending.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf-8');
  }
  const meta = JSON.parse(fs.readFileSync(metaPath(workspacePath, id), 'utf-8')) as SessionMeta;
  meta.messageCount = messages.length;
  meta.updatedAt = Date.now();
  if (!meta.title || meta.title === '新会话') {
    meta.title = deriveTitle(messages);
  }
  writeJsonAtomic(metaPath(workspacePath, id), meta);
  return { meta, savedCount: messages.length };
}

export function clearSession(workspacePath: string, id: string): SessionMeta {
  ensureDir(sessionDir(workspacePath, id));
  fs.writeFileSync(jsonlPath(workspacePath, id), '', 'utf-8');
  writeJsonAtomic(keyMovesPath(workspacePath, id), []);
  const meta = JSON.parse(fs.readFileSync(metaPath(workspacePath, id), 'utf-8')) as SessionMeta;
  meta.messageCount = 0;
  meta.updatedAt = Date.now();
  writeJsonAtomic(metaPath(workspacePath, id), meta);
  return meta;
}

export function deleteSession(workspacePath: string, id: string): void {
  fs.rmSync(sessionDir(workspacePath, id), { recursive: true, force: true });
}

/** 更新 meta.currentSkill（供 applySkill 持久化） */
export function updateSessionSkill(workspacePath: string, id: string, skill: string): void {
  const meta = JSON.parse(fs.readFileSync(metaPath(workspacePath, id), 'utf-8')) as SessionMeta;
  meta.currentSkill = skill;
  meta.updatedAt = Date.now();
  writeJsonAtomic(metaPath(workspacePath, id), meta);
}

// ============================================================
// 会话文件（files = 生成，uploads = 上传，intermediate/output = skill 产物）
// ============================================================

export type SessionFileDir = 'files' | 'uploads' | 'intermediate' | 'output';

function dirByKind(workspacePath: string, id: string, kind: SessionFileDir): string {
  return path.join(sessionDir(workspacePath, id), kind);
}

/** 会话根目录绝对路径（供 read_file / run_script 的 session 相对路径解析） */
export function getSessionDir(workspacePath: string, id: string): string {
  return sessionDir(workspacePath, id);
}

function scanDir(dir: string): SessionFileInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => {
      const p = path.join(dir, name);
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) return null;
        return { name, path: p, size: st.size, mtime: st.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((x): x is SessionFileInfo => x !== null)
    .sort((a, b) => b.mtime - a.mtime);
}

export function listSessionFiles(workspacePath: string, id: string): SessionFileList {
  return {
    uploads: scanDir(dirByKind(workspacePath, id, 'uploads')),
    files: scanDir(dirByKind(workspacePath, id, 'files')),
    intermediate: scanDir(dirByKind(workspacePath, id, 'intermediate')),
    output: scanDir(dirByKind(workspacePath, id, 'output')),
  };
}

/** 保存 agent 生成的文件到会话指定目录，返回绝对路径 */
export function saveSessionFile(
  workspacePath: string,
  id: string,
  filename: string,
  content: string,
  dir: SessionFileDir = 'files',
): string {
  const target = dirByKind(workspacePath, id, dir);
  ensureDir(target);
  const safe = path.basename(filename || 'untitled.md');
  const p = path.join(target, safe);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

/** 把用户上传的文件拷贝进会话 uploads 目录，返回新路径 */
export function copyUploadFile(workspacePath: string, id: string, sourcePath: string): string {
  const dir = dirByKind(workspacePath, id, 'uploads');
  ensureDir(dir);
  const name = path.basename(sourcePath);
  let target = path.join(dir, name);
  let i = 1;
  while (fs.existsSync(target)) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    target = path.join(dir, `${base}-${i}${ext}`);
    i += 1;
  }
  fs.copyFileSync(sourcePath, target);
  return target;
}

/** 把二进制内容写入会话 uploads 目录（如下载的 PDF），返回新路径 */
export function writeUploadBytes(
  workspacePath: string,
  id: string,
  filename: string,
  data: Buffer,
): string {
  const dir = dirByKind(workspacePath, id, 'uploads');
  ensureDir(dir);
  const safe = path.basename(filename || 'download');
  let target = path.join(dir, safe);
  let i = 1;
  while (fs.existsSync(target)) {
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    target = path.join(dir, `${base}-${i}${ext}`);
    i += 1;
  }
  fs.writeFileSync(target, data);
  return target;
}

// ============================================================
// 任务状态：todo.md（步骤光标）+ task.md（目标 + 决策日志）
// ============================================================

function todoPath(workspacePath: string, id: string): string {
  return path.join(sessionDir(workspacePath, id), 'todo.md');
}
function taskPath(workspacePath: string, id: string): string {
  return path.join(sessionDir(workspacePath, id), 'task.md');
}

const TODO_MARK: Record<TodoItem['status'], string> = {
  pending: ' ',
  in_progress: '~',
  done: 'x',
};

export function writeTodo(workspacePath: string, id: string, items: TodoItem[]): void {
  ensureDir(sessionDir(workspacePath, id));
  const lines = ['# 任务清单', ''];
  if (!items.length) {
    lines.push('（暂无任务）');
  } else {
    for (const t of items) {
      lines.push(`- [${TODO_MARK[t.status] ?? ' '}] ${t.title}`);
    }
  }
  fs.writeFileSync(todoPath(workspacePath, id), lines.join('\n') + '\n', 'utf-8');
}

/** 读取 todo.md 解析回结构化条目 */
export function readTodo(workspacePath: string, id: string): TodoItem[] {
  const p = todoPath(workspacePath, id);
  if (!fs.existsSync(p)) return [];
  const items: TodoItem[] = [];
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = /^- \[(.)\] (.+)$/.exec(line);
    if (!m) continue;
    const status: TodoItem['status'] =
      m[1] === 'x' ? 'done' : m[1] === '~' ? 'in_progress' : 'pending';
    items.push({ title: m[2].trim(), status });
  }
  return items;
}

const TASK_HEADER = '# 目标\n\n';
const DECISION_HEADER = '## 决策日志\n\n';

/** 写 task.md 目标段（覆盖目标，保留已有决策日志） */
export function writeTaskGoal(workspacePath: string, id: string, goal: string): void {
  ensureDir(sessionDir(workspacePath, id));
  const existing = fs.existsSync(taskPath(workspacePath, id))
    ? fs.readFileSync(taskPath(workspacePath, id), 'utf-8')
    : '';
  const decisions = existing.split(DECISION_HEADER)[1] ?? '';
  const out =
    TASK_HEADER + (goal.trim() ? goal.trim() + '\n\n' : '（未设定目标）\n\n') +
    DECISION_HEADER +
    decisions;
  fs.writeFileSync(taskPath(workspacePath, id), out, 'utf-8');
}

/** 追加一条决策到 task.md 决策日志，返回带时间戳的条目文本 */
export function appendDecision(
  workspacePath: string,
  id: string,
  decision: string,
  reason?: string,
): { time: string; decision: string; reason?: string } {
  ensureDir(sessionDir(workspacePath, id));
  let existing = fs.existsSync(taskPath(workspacePath, id))
    ? fs.readFileSync(taskPath(workspacePath, id), 'utf-8')
    : '';
  if (!existing) existing = TASK_HEADER + '（未设定目标）\n\n' + DECISION_HEADER;
  if (!existing.includes(DECISION_HEADER)) {
    existing = existing.trimEnd() + '\n\n' + DECISION_HEADER;
  }
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const line = `- [${time}] ${decision}${reason ? `（理由：${reason}）` : ''}\n`;
  fs.writeFileSync(taskPath(workspacePath, id), existing + line, 'utf-8');
  return { time, decision, reason };
}

/** 读取 task.md 全文（目标 + 决策日志） */
export function readTask(workspacePath: string, id: string): string {
  const p = taskPath(workspacePath, id);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf-8');
}

// ============================================================
// 关键行情区间：key-moves.json（按 toolCallId 关联消息，历史还原）
// ============================================================

function keyMovesPath(workspacePath: string, id: string): string {
  return path.join(sessionDir(workspacePath, id), 'key-moves.json');
}

/** 读取会话内所有关键行情区间（损坏时返回空数组） */
export function readKeyMoves(workspacePath: string, id: string): KeyMoveEntry[] {
  const p = keyMovesPath(workspacePath, id);
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return Array.isArray(data) ? (data as KeyMoveEntry[]) : [];
  } catch {
    return [];
  }
}

/** 追加/覆盖一条关键行情区间（按 toolCallId 去重；同一次工具调用重跑覆盖旧结果） */
export function appendKeyMoves(workspacePath: string, id: string, entry: KeyMoveEntry): void {
  ensureDir(sessionDir(workspacePath, id));
  const list = readKeyMoves(workspacePath, id);
  const idx = list.findIndex((e) => e.toolCallId === entry.toolCallId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeJsonAtomic(keyMovesPath(workspacePath, id), list);
}
