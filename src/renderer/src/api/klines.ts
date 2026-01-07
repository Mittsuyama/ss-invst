import dayjs from 'dayjs';
import { listGetRequest, request } from '@/lib/request';
import { RequestType } from '@shared/types/request';
import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';

const transformToPriceAndVolumnItem = (period: PeriodType, line: string) => {
  const items = line.split(',');
  return {
    period,
    timestamp: dayjs(items[0]).valueOf(),
    open: Number(items[1]),
    close: Number(items[2]),
    high: Number(items[3]),
    low: Number(items[4]),
    volume: Number(items[5]),
    turnover: Number(items[6]),
    amplitude: Number(items[7]),
    changeRate: Number(items[8]),
    change: Number(items[9]),
    turnoverRate: Number(items[10]),
  };
};

export const fetchKLines = async (id: string, type: PeriodType) => {
  let klt = '101';
  if (type === PeriodType.WEEK) {
    klt = '102';
  } else if (type === PeriodType.MONTH) {
    klt = '103';
  } else if (type === PeriodType.HOUR) {
    klt = '60';
  } else if (type === PeriodType.HALF_HOUR) {
    klt = '30';
  } else if (type === PeriodType.MINUTE) {
    klt = '1';
  } else if (type === PeriodType.FIVE_MINUTE) {
    klt = '5';
  } else if (type === PeriodType.FIFTEEN_MINUTE) {
    klt = '15';
  }

  const res = await request(
    RequestType.GET,
    'https://push2his.eastmoney.com/api/qt/stock/kline/get',
    {
      secid: id,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      // begin
      beg: '0',
      end: dayjs().add(1, 'day').format('YYYYMMDD'),
      // lmt: '210',
      // k line type
      klt,
      // return type
      rtntype: '6',
      // 复权
      fqt: '1',
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.klines as any[]).map<PriceAndVolumeItem>((line) =>
    transformToPriceAndVolumnItem(type, line),
  );
};

const trendParams = {
  fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f17',
  fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
  ndays: 1,
  isrc: 0,
  iscca: 0,
};

export const fetchTrendsList = async (ids: string[]) => {
  const batch = await listGetRequest(
    ids.map((id) => ({
      url: 'https://push2his.eastmoney.com/api/qt/stock/trends2/get',
      params: {
        secid: id,
        ...trendParams,
      },
    })),
  );
  return batch.map((res) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res.data.trends as any[]).map((line) =>
      transformToPriceAndVolumnItem(PeriodType.MINUTE, line),
    ),
  );
};

export const fetchTrends = async (id: string) => {
  const res = await request(
    RequestType.GET,
    'https://push2his.eastmoney.com/api/qt/stock/trends2/get',
    {
      secid: id,
      ...trendParams,
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.data.trends as any[]).map<PriceAndVolumeItem>((line) =>
    transformToPriceAndVolumnItem(PeriodType.MINUTE, line),
  );
};
