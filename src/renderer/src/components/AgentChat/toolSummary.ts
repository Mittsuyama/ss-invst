/** 取路径最后一段（文件名） */
export function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

/** 判断文件名是否为 markdown 文件 */
export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

/** 把工具参数摘要成一行「重要参数」，如 read_file 显示文件名 */
export function summarizeToolArgs(name: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  switch (name) {
    case 'search_stock':
      return str(a.keyword);
    case 'get_quote':
    case 'get_business':
      return str(a.secid);
    case 'get_klines':
      return `${str(a.secid)} · ${str(a.period) || 'day'} · ${str(a.limit) || '60'} 根`;
    case 'get_key_moves':
      return str(a.query);
    case 'get_financial_statements':
    case 'get_dividends':
      return `${str(a.secid)} · 近 ${str(a.years) || '5'} 年`;
    case 'tushare_query':
      return str(a.api_name);
    case 'read_file':
      return basename(str(a.path));
    case 'save_file':
      return str(a.filename);
    case 'download_url':
      return basename(str(a.url));
    case 'web_search':
      return str(a.query);
    case 'compute_factor':
    case 'analyze_factor':
      return `${str(a.secid)} · ${str(a.factor)}`;
    case 'use_skill':
      return str(a.name);
    case 'run_script':
      return basename(str(a.script));
    case 'decide':
      return str(a.decision);
    case 'list_skills':
      return '';
    case 'list_report_pdfs':
      return str(a.secid);
    case 'download_report_pdf':
      return `${str(a.secid)} · ${str(a.publish_situations)}`;
    default:
      return '';
  }
}
