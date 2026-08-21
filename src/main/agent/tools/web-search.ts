import type { AgentTool } from '@earendil-works/pi-agent-core';
import axios from 'axios';
import { ok, type PiType } from './common';

export function createWebSearchTool(Type: PiType): AgentTool {
  return {
    name: 'web_search',
    label: '网络搜索',
    description:
      '在互联网上搜索（DuckDuckGo HTML，无需 API key），返回结果的标题、URL 和摘要。用于补充行业动态、公司新闻、政策等网络信息。',
    parameters: Type.Object({
      query: Type.String({ description: '搜索关键词' }),
    }),
    execute: async (_id, params) => {
      const { query } = params as { query: string };
      const results = await ddgSearch(query);
      return ok({ count: results.length }, { query, results });
    },
  };
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function ddgSearch(query: string): Promise<SearchResult[]> {
  const res = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: query },
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    },
  });
  return parseDdgHtml(String(res.data));
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeDdgUrl(href: string): string {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    // ignore
  }
  return href;
}

function parseDdgHtml(html: string): SearchResult[] {
  const titleRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const titles = [...html.matchAll(titleRe)].map((m) => ({ url: decodeDdgUrl(m[1]), title: stripHtml(m[2]) }));
  const snippets = [...html.matchAll(snippetRe)].map((m) => stripHtml(m[1]));

  const results: SearchResult[] = [];
  for (let i = 0; i < Math.min(titles.length, 8); i++) {
    if (!titles[i].title) continue;
    results.push({ title: titles[i].title, url: titles[i].url, snippet: snippets[i] ?? '' });
  }
  return results;
}
