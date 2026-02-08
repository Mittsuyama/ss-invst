import { request } from '@/lib/request';
import { FilterColumn, FilterItem } from '@renderer/types/search';
import { RequestType } from '@shared/types/request';
import { StockInfo } from '@shared/types/stock';

export const fetchStockInfo = async (id: string): Promise<StockInfo> => {
  const keyMap = {
    名称: 'f58',
    行业代码: 'f12',
    行业名称: 'f14',
    市场: 'f107',
    代码: 'f57',
    总市值: 'f116',
    市盈率TTM: 'f164',
    市净率: '167',
    毛利率: 'f168',
    最新价: 'f43',
    涨跌幅: '169',
    上市日期: 'f189',
  };
  const [res, other] = await Promise.all([
    request(RequestType.GET, 'https://push2.eastmoney.com/api/qt/stock/get', {
      fltt: 1,
      invt: 2,
      fields: Object.values(keyMap).join(','),
      secid: id,
    }),
    request(RequestType.GET, 'https://push2.eastmoney.com/api/qt/slist/get', {
      fltt: 1,
      invt: 2,
      fields: Object.values(keyMap).join(','),
      pn: 1,
      np: 1,
      spt: 1,
      secid: id,
    }),
  ]);
  const { data } = res || {};
  const [market, code] = id.split('.');
  const name = data?.[keyMap['名称']];
  const pe = data?.[keyMap['市盈率TTM']] || 0;
  const pb = data?.[keyMap['市净率']];
  const roe = (pb / pe) * 100;
  const exchange = data?.[keyMap['市场']];
  const createTime = data?.[keyMap['上市日期']];
  const cap = data?.[keyMap['总市值']];
  const gpr = data?.[keyMap['毛利率']];
  const price = data?.[keyMap['最新价']];
  const changeRate = data?.[keyMap['涨跌幅']];

  const bizId = other?.data?.diff?.[1]?.[keyMap['行业代码']];
  const bizName = other?.data?.diff?.[1]?.[keyMap['行业名称']];

  return {
    id,
    market,
    code,
    pe,
    roe,
    pb,
    name,
    cap,
    bizId,
    bizName,
    exchange,
    gpr,
    price,
    changeRate,
    createTime,
  };
};

export const fetchFilterList = async (
  rule: string,
  options?: { pageSize: number; page: number },
) => {
  const { page = 1, pageSize = 500 } = options || {};
  const res = await request(
    RequestType.POST,
    'https://np-tjxg-g.eastmoney.com/api/smart-tag/stock/v3/pw/search-code',
    {
      pageSize,
      pageNo: page,
      fingerprint: '49772fe3016d8bb801d15a6a329ab7ac',
      biz: 'web_ai_select_stocks',
      keyWordNew: rule,
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (res.data.result.dataList as any[]).map<FilterItem>((item) => {
    const keys = Object.keys(item);
    const totakMarketValue = keys.find((key) => key.includes('TOAL_MARKET_VALUE')) || '';
    const kdjDayKey = keys.find((key) => key.includes('KDJ_J') && !key.includes('<')) || '';
    const kdjWeekKey = keys.find((key) => key.includes('KDJ_J<80>')) || '';
    const kdjHalfHourKey = keys.find((key) => key.includes('KDJ_J<40>')) || '';
    const kdjFifteenMinuteKey = keys.find((key) => key.includes('KDJ_J<30>')) || '';
    const code = item['SECURITY_CODE'];
    return {
      id: `${item['MARKET_NUM']}.${code}`,
      code,
      name: item['SECURITY_SHORT_NAME'],
      price: Number(item['NEWEST_PRICE']),
      chg: Number(item['CHG']),
      totalMarketValue: Number(item[totakMarketValue].replace('亿', '')),
      biz: item.INDUSTRY || '-',
      kdj_day: Number(item[kdjDayKey]),
      kdj_week: Number(item[kdjWeekKey]),
      kdj_half_hour: Number(item[kdjHalfHourKey]),
      kdj_fifteen_minute: Number(item[kdjFifteenMinuteKey]),
      ...item,
    };
  });

  return {
    list,
    total: res.data.result.total as number,
    columns: res.data.result.columns as FilterColumn[],
  };
};
