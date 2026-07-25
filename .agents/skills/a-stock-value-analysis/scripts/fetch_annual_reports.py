#!/usr/bin/env python3
"""
下载东方财富年报 PDF

用法:
  python fetch_annual_reports.py --stock-name "分众传媒" --stock-code "002027" --year 2025

说明:
  根据「分析xxx 2025年财报」自动下载近3年（2023、2024、2025）的年报 PDF。
  调用东方财富 API：
    1. fetchReportOriginInfo: 获取年报列表（含 PUBLISH_SITUATIONS 编号）
    2. fetchPdfUrl: 用编号获取 PDF 下载链接

  下载的 PDF 放到 reports/{拼音首字母}-{中文名}-{code}/input/ 目录下。
"""
import os
import re
import sys
import argparse
import requests
from typing import Optional
from pypinyin import lazy_pinyin

# ============================================================
# 东方财富 API（从 src/renderer/src/api/finance.ts 移植）
# ============================================================

EASTMONEY_REPORT_INFO_URL = (
    'https://datacenter.eastmoney.com/securities/api/data/v1/get'
)
EASTMONEY_PDF_URL = 'https://np-cnotice-stock.eastmoney.com/api/content/ann'

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Referer': 'https://emweb.securities.eastmoney.com/',
}


def stock_code_to_secu_code(stock_code: str) -> str:
    """股票代码转东财 SECUCODE 格式"""
    if stock_code.startswith('60') or stock_code.startswith('68'):
        return f'{stock_code}.SH'
    return f'{stock_code}.SZ'


def fetch_report_origin_info(stock_code: str) -> list:
    """获取年报列表（移植自 fetchReportOriginInfo）"""
    secu_code = stock_code_to_secu_code(stock_code)
    params = {
        'reportName': 'RPT_PCF10_ORIG_REPORT',
        'columns': (
            'YEAR,SECUCODE,SECURITY_CODE,REPORT_DATE,'
            'REPORT_TYPE,PUBLISH_SITUATIONS,OPINION_TYPE'
        ),
        'filter': f'(SECUCODE="{secu_code}")',
        'pageNumber': 1,
        'sortTypes': -1,
        'sortColumns': 'REPORT_DATE',
        'source': 'HSF10',
        'client': 'PC',
    }
    resp = requests.get(EASTMONEY_REPORT_INFO_URL, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get('code') != 0:
        print(f'API 错误: {data.get("message", "unknown")}')
        return []
    return data.get('result', {}).get('data', []) or []


def fetch_pdf_url(publish_situation: str) -> str:
    """用 PUBLISH_SITUATIONS 编号获取 PDF 下载链接（移植自 fetchPdfUrl）"""
    params = {
        'art_code': publish_situation,
        'client_source': 'web',
        'page_index': '1',
    }
    resp = requests.get(EASTMONEY_PDF_URL, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get('data', {}).get('attach_url', '') or ''


# ============================================================
# 辅助函数
# ============================================================

def get_pinyin_initials(name: str) -> str:
    """获取中文的拼音首字母，如 分众传媒 -> fzcm"""
    parts = lazy_pinyin(name)
    return ''.join(p[0] for p in parts)


def find_annual_report(items: list, year: int) -> Optional[dict]:
    """从年报列表中找到指定年份的年报"""
    for item in items:
        if item.get('YEAR') != year:
            continue
        report_type = item.get('REPORT_TYPE', '')
        # 优先匹配「年度报告」
        if '年度报告' in report_type or '年报' in report_type:
            # 排除半年报、季报、摘要等
            if '摘要' in report_type or '半年' in report_type or '季' in report_type:
                continue
            pub = item.get('PUBLISH_SITUATIONS', '')
            # PUBLISH_SITUATIONS 以 AN 开头表示有可下载的 PDF
            if pub.startswith('AN'):
                return item
    # 如果没找到精确匹配，放宽条件
    for item in items:
        if item.get('YEAR') != year:
            continue
        report_type = item.get('REPORT_TYPE', '')
        if '年度报告' in report_type:
            continue  # 已在上面检查过
        if '摘要' in report_type or '半年' in report_type or '季' in report_type:
            continue
        pub = item.get('PUBLISH_SITUATIONS', '')
        if pub.startswith('AN'):
            return item
    return None


def download_pdf(url: str, filepath: str) -> bool:
    """下载 PDF 文件"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=120, stream=True)
        resp.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f'  下载失败: {e}')
        return False


# ============================================================
# 主流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='下载东方财富年报 PDF')
    parser.add_argument('--stock-name', required=True, help='股票名称，如 分众传媒')
    parser.add_argument('--stock-code', required=True, help='股票代码，如 002027')
    parser.add_argument('--year', type=int, required=True, help='最新年份，如 2025')
    parser.add_argument(
        '--reports-dir',
        default='./reports',
        help='reports 目录路径（默认 ./reports）',
    )
    args = parser.parse_args()

    stock_name = args.stock_name
    stock_code = args.stock_code
    latest_year = args.year
    # 近3年
    target_years = [latest_year - 2, latest_year - 1, latest_year]

    # 创建公司目录
    pinyin_initials = get_pinyin_initials(stock_name)
    company_dir_name = f'{pinyin_initials}-{stock_name}-{stock_code}'
    company_dir = os.path.join(args.reports_dir, company_dir_name)
    input_dir = os.path.join(company_dir, 'input')
    os.makedirs(input_dir, exist_ok=True)

    print(f'公司: {stock_name}({stock_code})')
    print(f'目录: {company_dir}')
    print(f'目标年份: {target_years}')

    # 获取年报列表
    print('\n获取年报列表...')
    reports = fetch_report_origin_info(stock_code)
    if not reports:
        print('未获取到年报列表，请检查股票代码')
        sys.exit(1)
    print(f'共获取到 {len(reports)} 条报告记录')

    # 按年份下载
    success_count = 0
    for year in target_years:
        filepath = os.path.join(input_dir, f'{year}.pdf')
        if os.path.exists(filepath):
            print(f'\n[{year}] 已存在，跳过')
            success_count += 1
            continue

        print(f'\n[{year}] 查找年报...')
        report = find_annual_report(reports, year)
        if not report:
            print(f'  未找到 {year} 年的年报')
            continue

        pub = report.get('PUBLISH_SITUATIONS', '')
        report_type = report.get('REPORT_TYPE', '')
        opinion = report.get('OPINION_TYPE', '')
        print(f'  报告类型: {report_type}, 审计意见: {opinion}, 编号: {pub}')

        print(f'  获取 PDF 链接...')
        pdf_url = fetch_pdf_url(pub)
        if not pdf_url:
            print(f'  未获取到 PDF 链接')
            continue
        print(f'  PDF 链接: {pdf_url}')

        print(f'  下载中...')
        if download_pdf(pdf_url, filepath):
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            print(f'  下载完成: {filepath} ({size_mb:.1f} MB)')
            success_count += 1
        else:
            print(f'  下载失败')

    print(f'\n完成: {success_count}/{len(target_years)} 个年报已就绪')
    print(f'输入目录: {input_dir}')


if __name__ == '__main__':
    main()
