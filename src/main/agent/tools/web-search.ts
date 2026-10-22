import type { AgentTool } from '@earendil-works/pi-agent-core';
import { deepseekWebSearch } from '../data/deepseek';
import { ok, type PiType } from './common';

const MAX_CONTENT_CHARS = 8000;

function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return `${text.slice(0, MAX_CONTENT_CHARS)}\n……(单条正文过长，已截断，原文 ${text.length} 字符；如需完整内容请用 web_fetch 抓取该 URL)`;
}

export function createWebSearchTool(Type: PiType): AgentTool {
  return {
    name: 'web_search',
    label: '网页搜索',
    description:
      '[deepseek] 使用 DeepSeek 网页搜索检索公开网页，返回标题、URL、摘要、发布时间与权威度。适合查询最新新闻、公告、政策、行业动态等时效性信息；query 支持 site:、-site:、"精确短语"、lang:、after:、before: 等语法。默认只返回摘要，需要网页正文时把 need_content 设为 true（正文会截断），或用 web_fetch 精读指定 URL。搜索按请求计费，同一问题避免重复调用。',
    parameters: Type.Object({
      query: Type.String({
        minLength: 1,
        maxLength: 128,
        description:
          '搜索词，1~128 字符，支持 site:、-site:、"精确短语"、lang:、after:、before: 等语法',
      }),
      count: Type.Optional(
        Type.Integer({
          default: 10,
          minimum: 1,
          maximum: 50,
          description: '返回条数，默认 10',
        }),
      ),
      ori_question: Type.Optional(
        Type.String({
          maxLength: 128,
          description: '触发本次搜索的用户原始问题（<=128 字符），有助于理解搜索意图',
        }),
      ),
      localization: Type.Optional(
        Type.String({
          description: '用于本地化搜索结果的 IP 地址；一般留空，不要编造',
        }),
      ),
      need_content: Type.Optional(
        Type.Boolean({
          default: false,
          description: '是否返回网页正文，默认 false；正文较大时建议先用摘要，再 web_fetch 精读',
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        query: string;
        count?: number;
        ori_question?: string;
        localization?: string;
        need_content?: boolean;
      };
      if (typeof p.query !== 'string' || !p.query.trim()) {
        throw new Error('搜索词不能为空');
      }
      const query = p.query.trim();
      if (query.length > 128) {
        throw new Error(`搜索词过长（${query.length} 字符），最多 128 字符`);
      }
      const count = p.count ?? 10;
      if (!Number.isInteger(count) || count < 1 || count > 50) {
        throw new Error(`count 必须是 1~50 的整数，收到：${p.count}`);
      }
      const oriQuestion = p.ori_question?.trim() || undefined;
      if (oriQuestion && oriQuestion.length > 128) {
        throw new Error(`ori_question 过长（${oriQuestion.length} 字符），最多 128 字符`);
      }
      const localization = p.localization?.trim() || undefined;

      const results = await deepseekWebSearch({
        query,
        count,
        ori_question: oriQuestion,
        localization,
        need_content: p.need_content ?? false,
      });

      const items = results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        summary: r.summary,
        ...(r.content ? { content: truncateContent(r.content) } : {}),
        site_name: r.site_name,
        date: r.date,
        authority: r.authority,
        rerank_score: r.rerank_score,
      }));

      return ok(
        { count: items.length, query },
        { query, count: items.length, results: items },
        150000,
      );
    },
  };
}
