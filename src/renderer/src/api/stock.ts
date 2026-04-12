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
      fingerprint: 'f95cc8cd33dbefa5237c65ac21b3c1b3',
      biz: 'web_ai_select_stocks',
      keyWordNew: rule,
    },
    // {
    //   needAmbiguousSuggest: true,
    //   pageSize: 50,
    //   pageNo: 1,
    //   fingerprint: 'f95cc8cd33dbefa5237c65ac21b3c1b3',
    //   matchWord: '',
    //   shareToGuba: false,
    //   timestamp: '1775989097086476',
    //   requestId: 'i5Vx5DfnWvqeZ10kV26UezH24jkakB831775989098093',
    //   removedConditionIdList: [],
    //   ownSelectAll: false,
    //   needCorrect: true,
    //   client: 'WEB',
    //   product: '',
    //   needShowStockNum: false,
    //   biz: 'web_ai_select_stocks',
    //   xcId: 'xc10bd30f4da07007e15',
    //   gids: [],
    //   dxInfoNew: [],
    //   keyWordNew: rule,
    // },
    {
      Cookie:
        'qgqp_b_id=f95cc8cd33dbefa5237c65ac21b3c1b3; st_nvi=iZENfSgV3FFHOoEP2DlHH9f59; nid18=097053379b7193e6f91152f5db0067b0; nid18_create_time=1773327805475; gviem=EKXP1XbtVGAz5V-RU4gdn1e91; gviem_create_time=1773327805475; st_si=41201237578155; p_origin=https%3A%2F%2Fpassport2.eastmoney.com; mtp=1; ct=NMYXEySHMUscZg0nC57m4q6-bScMNc3svzLyfodH04kfzc_wk2BDB8f2ZkzmkPIP3FgQWvmok0t200DDe8MB3jkI-qmaQ4SJ4poGGPpdJhFzt4BdHL7yDpl8QznWaB-I_nWbndFpp0Xsz38Ms69_2MMRx9s8wL3uTIfRDG_F4No; ut=FobyicMgeV7cZJLM9GavAcciQryh29lRlEa3J6556LAZfegvIEnNn9THhQkL4qyQek5lDNEj_aDA1mbuIYa0CDwMqO5TPJs9BHBe-j1lJqYRrifKVVzcYGVP_rLdTXVeixED8Tgc_eTA8x4DfuED04K2LYHdH0tXNBi8KOLE577R7ekYzn6njl-F7sw-z6LEuDyJytpRzAz19SDDckIl8Hb7z5ry5MB-27MRwzgQ6beMsnEp_fPenyaqJ4DMFl9JPm_WDHsQ65rVcUU8w2B1-LluMdcwfFpfntleJNhp7Mzbrau8U7V37s3vIBaG5TcgmoFN8jFDctoAWinqsiCtf1KxzKRDK7QxFz5GT6C2n7J6OWqsNAqR67Z3IszB0kZJAiM3mdKq71r7FT8o-CS5fVnSzzQsZFB3yL3OdNN0QVFTDRnycaYbWRR39a2o4O4mmZRYuQmpARSV_Yn6bmIlU35EuYQMzDDyHcRMd4jvPAIHvAjBIeprc0kNIR5H2xcGh-HYEkUCRqZ-k-ooDVhzCcUjHS68rBVmKZ9l-9ZrcXhjhRismp3_bw; pi=4205366139643414%3Be4205366139643414%3BMitsuyama%3BxBowFEfARqg9lV7mtPUJEpSX5K5125fAR%2BUdn381CTvtbn%2Fhblrk1ujMkY48Aya1Ji2fxfc%2Bri44uDrpEy7mB3eNyk8sQE0RQI%2BzQOMK4WW4d0hJn0EwJqTEq%2BEmU266W5K63tScmTRmPuBAqENtQTrV8f1dlOrdwSLHTRluvYZul77CV7%2FJUCu%2BSgh73UaMNzEsDIhf%3BKMMwHAcPLSAosE0X%2BBNJuRxrnTaHIpTU9xB3JceUqWopXGuzUZns82ylCt0dXbx%2FEtYhTarClKuGSc%2Byz90Y12BpBwa1cQrDH5S4AyxGH%2FNd5w5bPAA2XKNAYaLlYOrJI3Ws4XYGZdBU5%2Fv9nf8LZkXDAaboAg%3D%3D; uidal=4205366139643414Mitsuyama; sid=160852035; vtpst=|; fullscreengg=1; fullscreengg2=1; rskey=y1OJcOXM5U3B1OGNKY3NwNDZ5ZUVnNEVzZz09IXCFS; st_asi=delete; st_psi=20260412173948501-119144370567-7742879183; st_pvi=88490171619700; st_sp=2022-11-06%2022%3A08%3A03; st_inirUrl=https%3A%2F%2Fwww.google.com.hk%2F; st_sn=10',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'no-cache',
      Host: 'np-tjxg-b.eastmoney.com',
      Origin: 'https://xuangu.eastmoney.com',
      Pragma: 'no-cache',
      Referer: 'https://xuangu.eastmoney.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      Curpage: 'stockResult',
      Jumpsource: 'edit_way',
    },
  );
  console.log(res);
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
