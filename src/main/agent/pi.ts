/**
 * pi 包（@earendil-works/pi-ai / pi-agent-core）是 ESM-only，
 * 而本项目主进程是 CommonJS，因此通过动态 import() 懒加载并缓存。
 */

type PiAi = typeof import('@earendil-works/pi-ai');
type PiCore = typeof import('@earendil-works/pi-agent-core');

let ai: PiAi | null = null;
let core: PiCore | null = null;

export async function loadPi(): Promise<{ ai: PiAi; core: PiCore }> {
  if (!ai) ai = await import('@earendil-works/pi-ai');
  if (!core) core = await import('@earendil-works/pi-agent-core');
  return { ai, core };
}
