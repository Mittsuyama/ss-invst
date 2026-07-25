---
name: a-stock-value-analysis
description: A股价值投资分析助手，根据个股分析模板生成完整的价值投资分析报告。当用户需要：分析某只A股的基本面、生成个股分析报告、做价值投资研究、分析财务报表数据、评估公司经营风险和机会时使用。依赖 tushare skill 获取基础财务数据，用户需提供近3年PDF财报文件用于深度分析。
---

# A股价值投资分析 Skill

## 概述

本 skill 用于对 A 股上市公司进行系统性的价值投资分析，最终生成 Markdown 报告和 HTML 报告。

## 依赖

- **tushare skill**：用于获取基础财务数据（利润表、资产负债表、现金流量表、每日指标等）。必须先安装：`npx skills add https://github.com/waditu-tushare/skills --skill tushare`
- **Tushare Token**：从仓库根目录的 `.env` 文件中读取 `TUSHARE_TOKEN` 环境变量。使用 tushare 获取数据前，需先加载该 token：
  ```python
  import os
  from dotenv import load_dotenv
  load_dotenv()  # 加载仓库根目录 .env
  token = os.environ.get('TUSHARE_TOKEN')
  import tushare as ts
  ts.set_token(token)
  pro = ts.pro_api()
  ```
  如果 `.env` 不存在或 `TUSHARE_TOKEN` 未设置，提示用户参考 `.env.example` 创建 `.env` 文件。
- 用户需提供近 3 年的 PDF 财报文件（年报），也可通过脚本自动下载（见第一阶段）

## 目录结构

分析数据放在仓库的 `reports/` 目录下，每个公司一个文件夹：

```
reports/
├── {拼音首字母}-{公司名}-{股票代码}/  # 如 fzcm-分众传媒-002027
│   ├── input/                  # PDF 年报（用户放入或脚本自动下载）
│   │   ├── 2025.pdf
│   │   ├── 2024.pdf
│   │   └── 2023.pdf
│   ├── intermediate/           # 中间文件（分阶段生成）
│   │   ├── {timestamp}_tushare_data.json
│   │   ├── {timestamp}_pdf_text.json
│   │   └── {timestamp}_analysis_draft.md
│   └── output/                 # 最终报告
│       ├── 2025-report.md
│       └── 2025-report.html
├── {另一家公司}/
│   ├── input/
│   ├── intermediate/
│   └── output/
```

- `input/`：用户放置 PDF 年报文件，文件名即年份（如 `2025.pdf`）
- `intermediate/`：中间文件，文件名带时间戳，便于断点续作
- `output/`：生成的最终报告，以最新年份命名

## 工作流程

流程较长且数据量大，分阶段执行，中间文件存入 `intermediate/` 目录。

### 第一阶段：确认信息

1. 确认用户要分析的股票名称/代码
2. 在 `reports/` 下找到或创建 `{拼音首字母}-{公司名}-{股票代码}/` 目录（如 `fzcm-分众传媒-002027`）
3. 确认 `input/` 目录中已有近 3 年的 PDF 财报文件
4. 如果没有 PDF 文件，使用脚本自动下载（见下方），或提示用户手动下载后放入 `input/` 目录

#### 自动下载年报 PDF

使用 `scripts/fetch_annual_reports.py` 从东方财富自动下载近 3 年年报 PDF：

```bash
python .agents/skills/a-stock-value-analysis/scripts/fetch_annual_reports.py \
  --stock-name "分众传媒" \
  --stock-code "002027" \
  --year 2025
```

- `--year` 指定最新年份，脚本自动下载 `year-2`、`year-1`、`year` 三年的年报
- 脚本会自动创建 `{拼音首字母}-{公司名}-{股票代码}/input/` 目录
- 已存在的 PDF 会跳过，不会重复下载
- 依赖：`pip install requests pypinyin`

### 第二阶段：获取基础数据（通过 tushare skill，可并行）

使用 tushare skill 获取以下数据（近 5 年），保存为 `intermediate/{timestamp}_tushare_data.json`：

- **利润表** (`income`)：营业收入、营业成本、销售费用、管理费用、研发费用、利息费用、净利润等
- **资产负债表** (`balancesheet`)：货币资金、应收账款、存货、固定资产、短期借款、长期借款、应付账款、流动资产合计、流动负债合计、总资产、总负债等
- **现金流量表** (`cashflow`)：经营活动现金流净额、投资活动现金流净额、筹资活动现金流净额、购建固定资产支付的现金等
- **每日指标** (`daily_basic`)：总市值、市盈率(TTM)、市净率、股息率等
- **分红送股** (`dividend`)：历史分红方案
- **基本面数据** (`fina_indicator`)：ROE、毛利率、净利率、应收账款周转天数、存货周转天数等

### 第三阶段：读取 PDF 财报（可与第二阶段并行）

使用 Read 工具读取 `input/` 目录中的 PDF 文件，提取关键信息，保存为 `intermediate/{timestamp}_pdf_text.json`：

- **管理层讨论与分析**：行业分析、经营情况讨论
- **审计意见**
- **附注中的关键信息**：会计政策变更、关联交易、或有事项等
- **合并报表项目解释**
- **母公司项目解释**

### 第四阶段：生成 Markdown 报告

根据 `references/个股分析模板.md` 和中间文件，生成分析报告草稿。注意：

> **重要**：模板中所有 `>` 引用块都是提示信息，**禁止**在最终报告中保留这些 quote 块。它们仅用于指导分析方向。

报告需填充模板中的所有表格和分析项，包括：

1. **基本信息**：主营业务概况、业务/产品分析、行业分析、SWOT 分析、各业务占比
2. **市场和财务基本信息**：总市值、股本数、上市时间、市盈率、每股自由现金流、杜邦分析、经营投融资现金流净额
3. **财务分析**：
   - 现金流分析（货币资金覆盖率、现金流净额/净利润等）
   - 负债分析（流动比率、速动比率、利息保障倍数、有息负债率等）
   - 应收账款分析（应收占比、回款率、计提比率等）
   - 存货分析（存货周转率、毛利率变动等）
   - 固定资产分析（固定资产周转率、折旧政策等）
   - 投资分析（减值冲销、持有到期资产转换等）
   - 净资产分析（分红融资行为等）
   - 营业收入分析（营业利润率、主营收入比等）
   - 费用分析（费用率、员工薪酬等）

每个分析项除填写数表外，还需给出文字分析和风险提示。

如分析维度较多，可拆分为多个 sub agent 并行处理不同章节，最后合并。

### 第五阶段：生成 HTML 报告

基于 Markdown 报告，使用 `scripts/generate_report.py` 生成 HTML 报告：

```bash
python .agents/skills/a-stock-value-analysis/scripts/generate_report.py \
  --stock-name "福耀玻璃" \
  --year 2025 \
  --root-dir ./reports/fybl-福耀玻璃-600660
```

HTML 报告需要：

1. **开头摘要区域**：
   - 本报告需要注意的重点（危险信号和机会信号），用红色/绿色标注
   - 重点图表展示（盈利能力趋势、资产负债结构、现金流走势等）
   - 后续完整数据的目录导航

2. **正文区域**：
   - 将 Markdown 内容转为 HTML，保持表格和层级结构
   - 关键指标用颜色标注（红=危险，绿=正面）
   - 表格添加斑马纹样式

3. **样式要求**：
   - 使用内联 CSS，不依赖外部文件
   - 支持暗色/亮色主题
   - 响应式布局
   - 表格可滚动

4. **柱状图要求**：
   - 柱状图必须并排显示（同一年份的多根柱子水平排列为一组）
   - 每组柱子下方显示年份标签
   - 柱子顶部显示数值
   - 图例说明各柱子含义

### 第六阶段：输出文件

将报告写入对应目录：

```
reports/{公司名}-{股票代码}/output/{最新年份}-report.md
reports/{公司名}-{股票代码}/output/{最新年份}-report.html
```

## 注意事项

1. **数据年份**：模板中的年份需替换为实际数据年份。如最新财报是 2025-12-31，则处理 2021-2025（5年）或 2023-2025（3年）的数据
2. **单位统一**：所有金额统一为「元」或「亿元」，百分比保留两位小数
3. **空值处理**：如某项数据无法获取，填写 `--` 并注明原因
4. **风险提示**：每个分析维度都需明确指出是否存在异常，不要回避问题
5. **客观分析**：基于数据和事实分析，不做主观投资建议
6. **并行处理**：第二阶段（tushare 取数）和第三阶段（PDF 读取）可并行；第四阶段的不同章节也可拆分给多个 sub agent 并行处理
7. **中间文件**：每个阶段的输出都保存到 `intermediate/` 目录，文件名带时间戳，便于断点续作
8. **Markdown 转义**：`generate_report.py` 的 `md_to_html` 函数需处理 `**bold**` → `<strong>` 等行内 Markdown 语法，避免原始 `**` 符号出现在 HTML 中
