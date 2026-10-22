import axios from 'axios';
import type { AgentProvider } from '@shared/types/agent';

const BASE_URL = 'https://api.deepseek.com';

/** DeepSeek 网页搜索/抓取的运行时上下文（每次提问时由 agent.ts 注入） */
export const deepseekRuntime: {
  provider: AgentProvider | '';
  apiKey: string;
} = {
  provider: '',
  apiKey: '',
};

export interface DeepSeekSearchOptions {
  query: string;
  count?: number;
  ori_question?: string;
  localization?: string;
  need_content?: boolean;
}

export interface DeepSeekSearchResult {
  rerank_score: number;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  content: string;
  site_name: string | null;
  site_icon: string | null;
  date: string | null;
  authority: number;
}

export interface DeepSeekFetchResult {
  title: string;
  content: string;
}

function assertAvailable(action: string): void {
  if (deepseekRuntime.provider !== 'deepseek') {
    throw new Error(
      `当前 LLM 提供商不是 DeepSeek，无法调用${action}。请切换到 DeepSeek 提供商后重试。`,
    );
  }
  if (!deepseekRuntime.apiKey) {
    throw new Error(
      `未配置 DeepSeek API Key，无法调用${action}。请在右上角「设置环境变量」中填写 DeepSeek API Key，或设置 DEEPSEEK_API_KEY 环境变量。`,
    );
  }
}

function validateQuery(raw: string): string {
  const query = raw.trim();
  if (!query) throw new Error('搜索词不能为空');
  if (query.length > 128) {
    throw new Error(`搜索词过长（${query.length} 字符），最多 128 字符`);
  }
  return query;
}

function validateFetchUrl(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('URL 不能为空');
  if (value.length > 8192) {
    throw new Error(`URL 过长（${value.length} 字符），最多 8192 字符`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`URL 格式不合法：${value}。请传完整的 HTTP/HTTPS 地址`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`仅支持 HTTP/HTTPS URL，收到：${parsed.protocol}`);
  }
  if (!parsed.hostname) throw new Error('URL 必须包含 host');
  if (parsed.username || parsed.password) throw new Error('URL 不能携带用户名或密码');
  return value;
}

function toDeepSeekError(error: unknown, action: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    const apiMessage = data?.error?.message || error.message;
    switch (status) {
      case 400:
        return new Error(
          `DeepSeek ${action}请求参数不合法：${apiMessage}。请检查输入格式与长度后重试。`,
        );
      case 401:
        return new Error(
          `DeepSeek ${action}鉴权失败：API Key 缺失或无效。请检查「设置环境变量」中的 DeepSeek API Key，或 DEEPSEEK_API_KEY 环境变量。`,
        );
      case 402:
        return new Error(`DeepSeek ${action}失败：账户余额不足，请充值后重试。`);
      case 403:
        return new Error(
          `DeepSeek ${action}被拒绝：目标站点或请求触发了安全策略，无法抓取该页面。`,
        );
      case 404:
        return new Error(
          `DeepSeek ${action}失败：未能获取可用的网页内容（URL 不可用、被目标站点拦截、内容类型不支持或没有可提取的正文）。请更换 URL 或改用网页搜索摘要。`,
        );
      case 408:
        return new Error(`DeepSeek ${action}超时（HTTP 408），可稍后重试。`);
      case 429:
        return new Error(`DeepSeek ${action}触发限流（HTTP 429，QPS 上限 5），请稍后重试。`);
      default:
        if (status && status >= 500) {
          return new Error(
            `DeepSeek ${action}服务端错误（HTTP ${status}）：${apiMessage}。可稍后重试。`,
          );
        }
        return new Error(
          `DeepSeek ${action}失败${status ? `（HTTP ${status}）` : ''}：${apiMessage}`,
        );
    }
  }

  const code = (error as { code?: string } | undefined)?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return new Error(`DeepSeek ${action}请求超时。请检查网络或代理设置后重试。`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`DeepSeek ${action}网络请求失败：${message}。请检查网络或代理设置后重试。`);
}

async function post<T>(path: string, body: unknown, action: string, timeout: number): Promise<T> {
  assertAvailable(action);
  try {
    const res = await axios.post<T>(`${BASE_URL}${path}`, body, {
      timeout,
      headers: {
        Authorization: `Bearer ${deepseekRuntime.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return res.data;
  } catch (e) {
    throw toDeepSeekError(e, action);
  }
}

/** 调用 DeepSeek 网页搜索（POST /v1/tools/search） */
export async function deepseekWebSearch(
  options: DeepSeekSearchOptions,
): Promise<DeepSeekSearchResult[]> {
  const body: Record<string, unknown> = { query: validateQuery(options.query) };
  if (options.count !== undefined) body.count = options.count;
  if (options.ori_question) body.ori_question = options.ori_question;
  if (options.localization) body.localization = options.localization;
  if (options.need_content !== undefined) body.need_content = options.need_content;

  const data = await post<{ results?: DeepSeekSearchResult[] }>(
    '/v1/tools/search',
    body,
    '网页搜索',
    30000,
  );
  const results = data?.results;
  if (!Array.isArray(results)) {
    throw new Error('DeepSeek 网页搜索返回格式异常：缺少 results 数组');
  }
  return results;
}

/** 调用 DeepSeek 网页抓取（POST /v1/tools/fetch） */
export async function deepseekWebFetch(url: string): Promise<DeepSeekFetchResult> {
  const data = await post<{ title?: string; content?: string }>(
    '/v1/tools/fetch',
    { url: validateFetchUrl(url) },
    '网页抓取',
    60000,
  );
  const content = data?.content;
  if (typeof content !== 'string') {
    throw new Error('DeepSeek 网页抓取返回格式异常：缺少 content 正文');
  }
  return { title: data?.title ?? '', content };
}
