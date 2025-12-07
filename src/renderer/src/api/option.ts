import { request } from '@/lib/request';
import { RequestType } from '@shared/types/request';
import { OptionItem, OptionType } from '@shared/types/option';

export const fetchOptionExpireList = async (secid: string) => {
  const res = await request(RequestType.GET, 'https://push2.eastmoney.com/api/qt/stock/get', {
    secid,
    mspt: 1,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.optionExpireInfo as any[]).map<{ date: string; days: number }>((item) => {
    return {
      date: String(item.date),
      days: Number(item.days),
    };
  });
};

export const fetchOptionListWithSecid = async (secid: string, type: OptionType) => {
  const fn = [
    1, 2, 3, 5, 6, 12, 13, 14, 108, 161, 298, 299, 249, 300, 302, 303, 325, 326, 327, 328, 329, 330,
    331, 332, 333, 334, 335, 336, 301, 152,
  ];

  // 0 是深交所，1 是上交所
  const mMap = {
    '0': '12',
    '1': '10',
  };
  const tMap = {
    '0': {
      call: '178',
      put: '179',
    },
    '1': {
      call: '173',
      put: '174',
    },
  };

  const [sType, code] = secid.split('.');
  const res = await request(RequestType.GET, 'https://push2.eastmoney.com/api/qt/clist/get', {
    po: 1,
    np: 1,
    pn: 1,
    pz: 999,
    fs: `m:${mMap[sType] || '10'}+c:${code}+t:${tMap[sType]?.[type] || '174'}`,
    fields: fn.map((n) => `f${n}`).join(','),
  });
  console.log(res);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.diff as any[]).map<OptionItem>((item) => {
    return {
      type,
      secid,
      change: item.f3,
      expire: String(item.f301),
      strike: item.f161,
      code: item.f12,
      name: item.f14,
      price: item.f2,
      volume: item.f5,
      amount: item.f6,
      position: item.f108,
      impliedVolatility: item.f249,
      theoreticalPrice: item.f300,
      intrinsicValue: item.f299,
      timeValue: item.f298,
      delta: item.f325,
      gamma: item.f326,
      theta: item.f327,
      vega: item.f328,
      rho: item.f329,
      leverageRatio: item.f302,
      actualLeverageRatio: item.f303,
      underlyingName: item.f333,
      underlyingPrice: item.f334,
    };
  });
};
