# A股价值投资分析 Skill

基于个股分析模板，对 A 股上市公司进行系统性价值投资分析，生成 Markdown + HTML 报告。

## 依赖

```bash
# 安装 tushare skill
npx skills add https://github.com/waditu-tushare/skills --skill tushare
```

## 目录结构

```
root/
├── 贵州茅台/
│   ├── input/           # 用户放入近3年PDF年报
│   │   ├── 2025.pdf
│   │   ├── 2024.pdf
│   │   └── 2023.pdf
│   └── output/          # 生成的报告
│       ├── 2025-report.md
│       └── 2025-report.html
├── 工商银行/
│   ├── input/
│   └── output/
```

## 使用方式

告诉 AI 你要分析哪只股票，提供 PDF 年报文件路径即可。AI 会：

1. 通过 tushare 获取基础财务数据
2. 读取 PDF 财报提取深度信息
3. 按 `references/个股分析模板.md` 生成 Markdown 报告
4. 运行 `scripts/generate_report.py` 生成 HTML 报告

## 文件说明

- `SKILL.md` — Skill 主配置文件
- `references/个股分析模板.md` — 报告模板（其中的 `>` 引用块为提示信息，不保留在最终报告中）
- `scripts/generate_report.py` — HTML 报告生成脚本
- `template/report.html` — HTML 报告模板
