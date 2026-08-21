import { utilityProcess } from 'electron';
import path from 'node:path';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { resolveSkillPath } from '../skill/skill-registry';
import { getSessionDir } from '../session/session-store';
import { sessionRuntime } from '../session/session-runtime';
import { ok, type PiType } from './common';

/** 脚本路径解析：绝对路径 > skill 相对路径 > session 相对路径 */
function resolveScript(input: string): string {
  if (path.isAbsolute(input)) return input;
  if (sessionRuntime.currentSkill) {
    const s = resolveSkillPath(sessionRuntime.currentSkill, input);
    if (s) return s;
  }
  if (sessionRuntime.workspacePath && sessionRuntime.sessionId) {
    return path.resolve(getSessionDir(sessionRuntime.workspacePath, sessionRuntime.sessionId), input);
  }
  return input;
}

interface ScriptResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runScript(scriptPath: string, args: string[], timeoutSec: number, cwd: string): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    let child: Electron.UtilityProcess;
    try {
      child = utilityProcess.fork(scriptPath, args, { cwd, stdio: 'pipe' });
    } catch (e) {
      reject(e);
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // 进程可能已退出
      }
    }, timeoutSec * 1000);

    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({ exitCode: code, stdout, stderr, timedOut });
      }
    });
  });
}

export function createRunScriptTool(Type: PiType): AgentTool {
  return {
    name: 'run_script',
    label: '执行脚本',
    description:
      '执行当前 skill 内（或会话目录内）的 Node 脚本（.mjs/.cjs）。script 可为绝对路径、skill 相对路径（如 scripts/render-report.mjs）或会话相对路径。args 为参数数组，timeoutSec 默认 120 秒。',
    parameters: Type.Object({
      script: Type.String({ description: '脚本路径' }),
      args: Type.Optional(Type.Array(Type.String())),
      timeoutSec: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params) => {
      const { script, args, timeoutSec } = params as {
        script: string;
        args?: string[];
        timeoutSec?: number;
      };
      if (!sessionRuntime.workspacePath || !sessionRuntime.sessionId) {
        throw new Error('当前没有打开的会话，无法执行脚本');
      }
      const scriptPath = resolveScript(script);
      const cwd = getSessionDir(sessionRuntime.workspacePath, sessionRuntime.sessionId);
      const result = await runScript(scriptPath, args ?? [], timeoutSec ?? 120, cwd);
      if (result.exitCode !== 0 || result.timedOut) {
        const hint = result.timedOut ? `（超时 ${timeoutSec ?? 120}s）` : `（exit ${result.exitCode}）`;
        throw new Error(`脚本执行失败${hint}：${result.stderr || result.stdout || '无输出'}`);
      }
      return ok(result, { ...result });
    },
  };
}
