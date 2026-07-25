#!/usr/bin/env python3
"""
A股价值投资分析报告生成脚本

用法:
  python generate_report.py --stock-name "福耀玻璃" --year 2025 --root-dir ./reports/fybl-福耀玻璃-600660

功能:
  1. 读取 output/{year}-report.md
  2. 解析 Markdown 中的表格数据，提取关键指标
  3. 生成摘要（危险信号、机会信号）
  4. 生成柱状图 HTML（从 md 表格中提取数据）
  5. 基于 template/report.html 生成完整 HTML 报告
  6. 输出到 output/{year}-report.html
"""

import argparse
import re
import os
import json
from datetime import datetime


# ============================================================
# Markdown 解析
# ============================================================

def parse_tables(md_content: str) -> list:
    """解析 Markdown 中的所有表格，返回 [{title, headers, rows}]"""
    tables = []
    lines = md_content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # 找到表格起始（| 开头）
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[-:\s|]+\|$', lines[i + 1].strip()):
            # 向上找标题
            title = ""
            for j in range(i - 1, max(i - 5, -1), -1):
                prev = lines[j].strip()
                if prev and not prev.startswith('|') and not prev.startswith('>') and not prev.startswith('注'):
                    title = prev.lstrip('#').strip()
                    break

            headers = [h.strip() for h in line.split('|') if h.strip()]
            i += 2  # 跳过分隔行
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().split('|') if c.strip()]
                if cells:
                    rows.append(cells)
                i += 1

            tables.append({'title': title, 'headers': headers, 'rows': rows})
        else:
            i += 1
    return tables


def find_table(tables: list, title_keywords: list):
    """根据标题关键词查找表格。优先精确匹配，其次子串匹配。"""
    # 第一轮：精确匹配（标题完全等于关键词）
    for t in tables:
        for kw in title_keywords:
            if t['title'].strip() == kw:
                return t
    # 第二轮：子串匹配
    for t in tables:
        for kw in title_keywords:
            if kw in t['title']:
                return t
    return None


def extract_numeric(val: str):
    """从字符串中提取数值，去掉 %、亿、万 等单位"""
    if not val or val == '--':
        return None
    # 去掉百分号
    s = val.replace('%', '').replace('元', '').strip()
    # 处理 亿/万
    multiplier = 1
    if '亿' in s:
        multiplier = 1e8
        s = s.replace('亿', '')
    elif '万' in s:
        multiplier = 1e4
        s = s.replace('万', '')
    try:
        return float(s) * multiplier
    except ValueError:
        return None


# ============================================================
# 柱状图生成
# ============================================================

def generate_bar_chart(title: str, years: list, series: list) -> str:
    """
    生成柱状图 HTML

    Args:
        title: 图表标题
        years: ['2021', '2022', '2023', '2024', '2025']
        series: [{'name': '营业收入', 'color': '#36a2eb', 'values': [236, 281, 332, 393, 458]}, ...]
    """
    # 计算最大值用于高度比例
    all_values = []
    for s in series:
        for v in s['values']:
            if v is not None:
                all_values.append(abs(v))
    max_val = max(all_values) if all_values else 1

    # 图例
    legend_html = '<div class="chart-legend">'
    for s in series:
        legend_html += f'<div class="legend-item"><div class="legend-dot" style="background:{s["color"]};"></div>{s["name"]}</div>'
    legend_html += '</div>'

    # 柱状图
    chart_html = '<div class="bar-chart">'
    for i, year in enumerate(years):
        chart_html += '<div class="bar-group">'
        chart_html += '<div class="bar-group-bars">'
        for s in series:
            val = s['values'][i] if i < len(s['values']) else None
            if val is not None and val != 0:
                height_pct = max(2, (abs(val) / max_val) * 100)
                display_val = format_value(val)
                chart_html += (
                    f'<div class="bar" style="height:{height_pct:.1f}%;background:{s["color"]};">'
                    f'<div class="bar-value">{display_val}</div>'
                    f'</div>'
                )
            else:
                chart_html += f'<div class="bar" style="height:0;background:{s["color"]};"></div>'
        chart_html += '</div>'  # bar-group-bars
        chart_html += f'<div class="bar-label">{year}</div>'
        chart_html += '</div>'  # bar-group
    chart_html += '</div>'  # bar-chart

    return f'''
    <div class="chart-container">
      <div class="chart-title">{title}</div>
      {legend_html}
      {chart_html}
    </div>'''


def format_value(val: float) -> str:
    """格式化数值显示"""
    if abs(val) >= 1e8:
        return f'{val / 1e8:.1f}'
    elif abs(val) >= 1e4:
        return f'{val / 1e4:.1f}'
    elif abs(val) < 1:
        return f'{val:.2f}'
    else:
        return f'{val:.0f}'


def extract_charts_from_md(md_content: str, tables: list) -> str:
    """从 Markdown 表格中提取数据生成图表"""
    charts_html = ''

    # 1. 营业收入与净利润趋势
    # 从"核心数据汇总表"中提取，因为该表同时包含营业收入和净利润行
    income_table = None
    for t in tables:
        # 找到同时包含"营业收入"和"净利润"行的表格
        has_rev = any('营业收入' in (r[0] if r else '') for r in t['rows'])
        has_np = any('净利润' in (r[0] if r else '') for r in t['rows'])
        if has_rev and has_np:
            income_table = t
            break
    if income_table:
        years = income_table['headers'][1:] if income_table['headers'][0] in ['类目', '项目', '指标'] else income_table['headers']
        revenue_row = None
        profit_row = None
        for row in income_table['rows']:
            row_label = row[0] if row else ''
            if '营业收入' in row_label or '营收' in row_label:
                revenue_row = row
            if '净利润' in row_label:
                profit_row = row
        if revenue_row and profit_row:
            rev_values = [extract_numeric(v) for v in revenue_row[1:]]
            profit_values = [extract_numeric(v) for v in profit_row[1:]]
            years_labels = [str(y) for y in years]
            charts_html += generate_bar_chart(
                '营业收入与净利润趋势（亿元）',
                years_labels,
                [
                    {'name': '营业收入', 'color': '#36a2eb', 'values': [v / 1e8 if v else None for v in rev_values]},
                    {'name': '净利润', 'color': '#28a745', 'values': [v / 1e8 if v else None for v in profit_values]},
                ],
            )

    # 2. 杜邦分析 ROE
    dupont_table = find_table(tables, ['杜邦'])
    if dupont_table:
        roe_row = None
        for row in dupont_table['rows']:
            if 'ROE' in row[0]:
                roe_row = row
                break
        if roe_row:
            years_labels = [str(h) for h in dupont_table['headers'][1:]]
            roe_values = [extract_numeric(v) for v in roe_row[1:]]
            charts_html += generate_bar_chart(
                'ROE 趋势（%）',
                years_labels,
                [{'name': 'ROE', 'color': '#ff6384', 'values': roe_values}],
            )

    # 3. 现金流走势
    # 找到同时包含经营、投资、筹资三个行的表格
    cashflow_table = None
    for t in tables:
        has_op = any('经营' in (r[0] if r else '') for r in t['rows'])
        has_inv = any('投资' in (r[0] if r else '') for r in t['rows'])
        has_fin = any('筹资' in (r[0] if r else '') for r in t['rows'])
        if has_op and has_inv and has_fin:
            cashflow_table = t
            break
    if cashflow_table:
        years_labels = []
        operate_values = []
        invest_values = []
        finance_values = []
        for row in cashflow_table['rows']:
            label = row[0] if row else ''
            if '经营' in label:
                operate_values = [extract_numeric(v) for v in row[1:]]
            elif '投资' in label:
                invest_values = [extract_numeric(v) for v in row[1:]]
            elif '筹资' in label:
                finance_values = [extract_numeric(v) for v in row[1:]]

        # 尝试从表头获取年份
        if len(cashflow_table['headers']) > 2:
            years_labels = [str(h) for h in cashflow_table['headers'][1:]]

        if operate_values or invest_values or finance_values:
            if not years_labels:
                years_labels = [str(2025 - i) for i in range(len(operate_values))]
            charts_html += generate_bar_chart(
                '现金流走势（亿元）',
                years_labels,
                [
                    {'name': '经营', 'color': '#36a2eb', 'values': [v / 1e8 if v else None for v in operate_values]},
                    {'name': '投资', 'color': '#ff9f40', 'values': [v / 1e8 if v else None for v in invest_values]},
                    {'name': '筹资', 'color': '#9966ff', 'values': [v / 1e8 if v else None for v in finance_values]},
                ],
            )

    return charts_html if charts_html else '<p style="color: var(--muted);">详见报告正文各章节</p>'


# ============================================================
# 摘要生成
# ============================================================

def parse_summary(md_content: str) -> dict:
    """解析 Markdown 报告，提取危险信号和机会信号"""
    risks = []
    opportunities = []

    risk_keywords = ['异常', '风险', '下降', '减少', '不足', '高息', '借短投长',
                     '造假', '冲销', '变更', '显失公平', '微亏', '大亏', '转资产',
                     '承压', '恶化', '警惕', '负面']
    opportunity_keywords = ['增长', '提升', '改善', '优势', '稳定', '健康', '充足',
                            '创新高', '领先', '龙头', '突破']

    lines = md_content.split('\n')
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or stripped.startswith('|') or stripped.startswith('>'):
            continue
        if len(stripped) < 10:
            continue

        text = stripped.lstrip('- ').strip()
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # 去掉 ** 加粗标记
        if not text:
            continue

        for kw in risk_keywords:
            if kw in text and text not in risks:
                risks.append(text)
                break
        else:
            for kw in opportunity_keywords:
                if kw in text and text not in opportunities:
                    opportunities.append(text)
                    break

    return {
        'risks': risks[:8],
        'opportunities': opportunities[:8],
    }


# ============================================================
# Markdown 转 HTML
# ============================================================

def heading_to_id(text: str) -> str:
    """将 h2 标题文本映射为 nav 锚点 ID"""
    mapping = {
        '市场和财务基本信息': 'market',
        '基本信息': 'basic',
        '主营业务': 'business',
        '现金流分析': 'cashflow',
        '负债分析': 'debt',
        '应收账款': 'receivable',
        '存货': 'inventory',
        '固定资产': 'fixed',
        '投资': 'investment',
        '净资产': 'equity',
        '营业收入': 'revenue',
        '费用': 'expense',
    }
    for key, val in mapping.items():
        if key in text:
            return val
    return ''


def md_to_html(md_content: str) -> str:
    """简易 Markdown 转 HTML"""
    # 去掉模板中的 quote 提示块
    html = re.sub(r'^> .+$', '', md_content, flags=re.MULTILINE)

    # 标题
    html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(
        r'^## (.+)$',
        lambda m: f'<h2 id="{heading_to_id(m.group(1))}">{m.group(1)}</h2>',
        html,
        flags=re.MULTILINE,
    )
    html = re.sub(
        r'^# (.+)$',
        lambda m: f'<h1 id="{heading_to_id(m.group(1))}">{m.group(1)}</h1>',
        html,
        flags=re.MULTILINE,
    )

    # 加粗: **text** -> <strong>text</strong>
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

    # 表格
    html = re.sub(
        r'\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)',
        lambda m: convert_table(m.group(0)),
        html,
        flags=re.MULTILINE,
    )

    # 列表
    html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'(<li>.+</li>\n?)+', lambda m: f'<ul>{m.group(0)}</ul>', html, flags=re.MULTILINE)

    # 段落
    html = re.sub(r'\n\n', '</p><p>', html)
    html = f'<p>{html}</p>'

    # 清理空标签
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'<p>(<h[1-4])', r'\1', html)
    html = re.sub(r'(</h[1-4]>)</p>', r'\1', html)
    html = re.sub(r'<p>(<ul>)', r'\1', html)
    html = re.sub(r'(</ul>)</p>', r'\1', html)
    html = re.sub(r'<p>(<table)', r'\1', html)
    html = re.sub(r'(</table>)</p>', r'\1', html)

    return html


def convert_table(md_table: str) -> str:
    """将 Markdown 表格转为 HTML 表格"""
    lines = [l.strip() for l in md_table.strip().split('\n') if l.strip()]
    if len(lines) < 2:
        return md_table

    headers = [h.strip() for h in lines[0].split('|') if h.strip()]
    rows = []
    for line in lines[2:]:
        cells = [c.strip() for c in line.split('|') if c.strip()]
        if cells:
            rows.append(cells)

    html = '<table>\n<thead>\n<tr>'
    for h in headers:
        html += f'<th>{h}</th>'
    html += '</tr>\n</thead>\n<tbody>\n'
    for row in rows:
        html += '<tr>'
        for cell in row:
            html += f'<td>{cell}</td>'
        html += '</tr>\n'
    html += '</tbody>\n</table>\n'

    return html


# ============================================================
# 主生成函数
# ============================================================

def generate_html(stock_name: str, year: str, md_content: str, template_path: str) -> str:
    """基于模板生成 HTML 报告"""
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    parsed = parse_summary(md_content)
    tables = parse_tables(md_content)
    charts_html = extract_charts_from_md(md_content, tables)

    def strip_md(text):
        return re.sub(r'\*\*(.+?)\*\*', r'\1', text)

    risks_html = '\n      '.join(f'<li>{strip_md(r)}</li>' for r in parsed['risks'])
    opportunities_html = '\n      '.join(f'<li>{strip_md(o)}</li>' for o in parsed['opportunities'])
    body_html = md_to_html(md_content)

    html = template.replace('{{stockName}}', stock_name)
    html = html.replace('{{year}}', year)
    html = html.replace('{{generatedAt}}', datetime.now().strftime('%Y-%m-%d %H:%M'))
    html = html.replace('{{risks}}', risks_html or '<li>无明显危险信号</li>')
    html = html.replace('{{opportunities}}', opportunities_html or '<li>暂未发现明显机会</li>')
    html = html.replace('{{charts}}', charts_html)
    html = html.replace('{{bodyContent}}', body_html)

    return html


def main():
    parser = argparse.ArgumentParser(description='生成A股价值投资分析HTML报告')
    parser.add_argument('--stock-name', required=True, help='股票名称')
    parser.add_argument('--year', required=True, help='报告年份')
    parser.add_argument('--root-dir', required=True, help='公司目录路径（如 ./reports/fybl-福耀玻璃-600660）')
    parser.add_argument('--template', default=None, help='HTML模板路径')

    args = parser.parse_args()

    output_dir = os.path.join(args.root_dir, 'output')
    md_path = os.path.join(output_dir, f'{args.year}-report.md')
    html_path = os.path.join(output_dir, f'{args.year}-report.html')

    if args.template:
        template_path = args.template
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(script_dir, '..', 'template', 'report.html')

    if not os.path.exists(md_path):
        print(f'错误: Markdown 报告不存在: {md_path}')
        print('请先生成 Markdown 报告。')
        return

    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    html = generate_html(args.stock_name, args.year, md_content, template_path)

    os.makedirs(output_dir, exist_ok=True)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'HTML 报告已生成: {html_path}')


if __name__ == '__main__':
    main()
