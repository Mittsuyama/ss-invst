import fs from 'node:fs';
import path from 'node:path';

/**
 * 极简 .env 加载器：将项目根目录 .env 中的键值写入 process.env（不覆盖已有值）。
 * 用于开发环境兜底（如 TUSHARE_TOKEN / DEEPSEEK_API_KEY 等）。
 */
export function loadDotEnv(): void {
  try {
    const file = path.join(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // 忽略读取失败
  }
}
