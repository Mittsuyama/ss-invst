import dayjs from 'dayjs';
import { getDefaultStore } from 'jotai';
import { RequestType } from '@shared/types/request';
import { envAtom } from '@/models/detail';

export const SSE_TICK_DETAILS_DATA_CHANNEL = 'sse-tick-details-data';

export interface TrendItem {
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  avgPrice: number;
}

export interface SseTickDetailsResponse {
  rc?: number;
  rt?: number;
  full?: number;
  data?: {
    preClose?: number;
    prePrice?: number;
    trends?: string[];
  } | null;
}

function parseTrend(line: string): TrendItem {
  const [datetime, open, close, high, low, volume, turnover, avgPrice] = line.split(',');
  return {
    timestamp: dayjs(datetime).valueOf(),
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    turnover: Number(turnover),
    avgPrice: Number(avgPrice),
  };
}

export function parseSseResponse(res: SseTickDetailsResponse): {
  prePrice?: number;
  trends: TrendItem[];
} {
  const data = res.data;
  const trends = data?.trends ?? [];
  return {
    prePrice: data?.preClose ?? data?.prePrice,
    trends: trends.map(parseTrend),
  };
}

export function startTickDetailsSse(secid: string) {
  const cookie = getDefaultStore().get(envAtom).cookie;
  window.electron.ipcRenderer.send(RequestType.SSE_TICK_DETAILS_START, secid, cookie);
}

export function stopTickDetailsSse() {
  window.electron.ipcRenderer.send(RequestType.SSE_TICK_DETAILS_STOP);
}

export function onTickDetailsData(callback: (res: SseTickDetailsResponse) => void): () => void {
  const handler = (_event: unknown, data: SseTickDetailsResponse) => callback(data);
  window.electron.ipcRenderer.on(SSE_TICK_DETAILS_DATA_CHANNEL, handler);
  return () => {
    window.electron.ipcRenderer.removeListener(SSE_TICK_DETAILS_DATA_CHANNEL, handler);
  };
}
