import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { AgentEvent, AgentProvider } from '@shared/types/agent';
import { loadPi } from '../pi';
import { createSearchStockTool } from './search-stock';
import { createGetQuoteTool } from './get-quote';
import { createGetKlinesTool } from './get-klines';
import { createGetKeyMovesTool } from './get-key-moves';
import { createGetDailyAdjustedTool } from './get-daily-adjusted';
import { createGetStkFactorsTool } from './get-stk-factors';
import { createGetFinancialStatementsTool } from './get-financial-statements';
import { createGetBusinessTool } from './get-business';
import { createGetDividendsTool } from './get-dividends';
import { createTushareQueryTool } from './tushare-query';
import { createReadFileTool } from './read-file';
import { createSaveFileTool } from './save-file';
import { createUpdateTodoTool } from './update-todo';
import { createReadTodoTool } from './read-todo';
import { createDownloadUrlTool } from './download-url';
import { createComputeFactorTool } from './compute-factor';
import { createAnalyzeFactorTool } from './analyze-factor';
import { createListSkillsTool } from './list-skills';
import { createUseSkillTool } from './use-skill';
import { createRunScriptTool } from './run-script';
import { createDecideTool } from './decide';
import { createListReportPdfsTool } from './list-report-pdfs';
import { createDownloadReportPdfTool } from './download-report-pdf';
import { createWebSearchTool } from './web-search';
import { createWebFetchTool } from './web-fetch';

/** 工具运行时依赖（由 agent.ts 注入） */
export interface AgentToolContext {
  /** 向渲染进程推送事件 */
  emit: (event: AgentEvent) => void;
  /** 选定/清空当前 skill，返回其 SKILL.md 全文 */
  applySkill: (name: string | undefined) => string | undefined;
}

/** 仅在 DeepSeek 提供商下可用的工具名 */
const DEEPSEEK_ONLY_TOOL_NAMES = new Set(['web_search', 'web_fetch']);

/** 按 LLM 提供商过滤工具：非 DeepSeek 时不向模型暴露网页搜索/抓取 */
export function toolsForProvider(tools: AgentTool[], provider: AgentProvider): AgentTool[] {
  if (provider === 'deepseek') return tools;
  return tools.filter((tool) => !DEEPSEEK_ONLY_TOOL_NAMES.has(tool.name));
}

/** 组装所有投资分析工具（Type 从 pi-ai 懒加载） */
export async function createTools(ctx: AgentToolContext): Promise<AgentTool[]> {
  const { ai } = await loadPi();
  const Type = ai.Type;

  return [
    createUpdateTodoTool(Type, ctx.emit),
    createReadTodoTool(Type),
    createDecideTool(Type, ctx.emit),
    createListSkillsTool(Type),
    createUseSkillTool(Type, ctx.applySkill),
    createRunScriptTool(Type),
    createWebSearchTool(Type),
    createWebFetchTool(Type),
    createDownloadUrlTool(Type, ctx.emit),
    createComputeFactorTool(Type),
    createAnalyzeFactorTool(Type),
    createListReportPdfsTool(Type),
    createDownloadReportPdfTool(Type, ctx.emit),
    createSearchStockTool(Type),
    createGetQuoteTool(Type),
    createGetKlinesTool(Type),
    createGetKeyMovesTool(Type, ctx.emit),
    createGetDailyAdjustedTool(Type),
    createGetStkFactorsTool(Type),
    createGetFinancialStatementsTool(Type),
    createGetBusinessTool(Type),
    createGetDividendsTool(Type),
    createTushareQueryTool(Type),
    createReadFileTool(Type),
    createSaveFileTool(Type, ctx.emit),
  ];
}
