import type { AgentTool } from '@earendil-works/pi-agent-core';
import { deepseekWebFetch } from '../data/deepseek';
import { ok, type PiType } from './common';

const MAX_CONTENT_CHARS = 180000;

export function createWebFetchTool(Type: PiType): AgentTool {
  return {
    name: 'web_fetch',
    label: '网页抓取',
    description:
      '[deepseek] 抓取单个公开网页并返回 Markdown 正文，适合在 web_search 找到 URL 后精读原文、核对公告/新闻细节。仅支持公开可访问的 HTTP/HTTPS 页面，不能抓取需要登录或反爬严格的内容；抓取按请求计费，避免重复抓取同一 URL。',
    parameters: Type.Object({
      url: Type.String({
        maxLength: 8192,
        description: '要抓取的网页地址，必须是含 host 的 HTTP/HTTPS URL，且不能携带用户名或密码',
      }),
    }),
    execute: async (_id, params) => {
      const { url } = params as { url: string };
      if (typeof url !== 'string' || !url.trim()) {
        throw new Error('URL 不能为空');
      }
      const target = url.trim();
      const page = await deepseekWebFetch(target);
      if (!page.content.trim()) {
        throw new Error(
          `网页抓取成功，但未提取到正文：${target}。请更换 URL 或改用 web_search 的摘要。`,
        );
      }
      const content =
        page.content.length > MAX_CONTENT_CHARS
          ? `${page.content.slice(0, MAX_CONTENT_CHARS)}\n……(正文过长，已截断，原文 ${page.content.length} 字符)`
          : page.content;
      return ok(
        { title: page.title, url: target, chars: page.content.length },
        { title: page.title, url: target, content },
        200000,
      );
    },
  };
}
