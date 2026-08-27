import {
  Activity,
  BarChart3,
  Briefcase,
  Calculator,
  ClipboardList,
  Coins,
  Database,
  Download,
  FileDown,
  FileSearch,
  FileText,
  Layers,
  Lightbulb,
  LineChart,
  ListTodo,
  Search,
  Sparkles,
  Terminal,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { SavedFileInfo } from '@shared/types/agent';

/** 空会话时展示的建议问题 */
export const SUGGESTIONS = [
  '帮我分析贵州茅台今年的财报，做一个价值投资判断',
  '对宁德时代近一个月的日K线做技术分析',
  '对比一下招商银行和兴业银行的基本面',
];

/** 文件目录 → 展示名 */
export const FILE_DIR_LABELS: Record<SavedFileInfo['dir'], string> = {
  files: '生成文件',
  output: '最终报告',
  intermediate: '中间产物',
  uploads: '上传',
};

/** 工具名 → 功能图标（展开箭头旁展示） */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  update_todo: ListTodo,
  read_todo: ClipboardList,
  decide: Lightbulb,
  list_skills: Layers,
  use_skill: Sparkles,
  run_script: Terminal,
  download_url: Download,
  compute_factor: Calculator,
  analyze_factor: BarChart3,
  search_stock: Search,
  get_quote: TrendingUp,
  get_klines: LineChart,
  get_key_moves: Activity,
  get_financial_statements: FileText,
  get_business: Briefcase,
  get_dividends: Coins,
  tushare_query: Database,
  list_report_pdfs: FileText,
  download_report_pdf: FileDown,
  read_file: FileSearch,
  save_file: FileDown,
};
