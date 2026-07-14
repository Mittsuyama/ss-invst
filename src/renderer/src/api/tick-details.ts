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

// ---- 回调注册表 ----
type TickCallback = (res: SseTickDetailsResponse) => void;
const callbacks = new Map<string, Set<TickCallback>>();

// ---- 订阅计数 (用于管理 SSE 连接生命周期) ----
const subscriptionCount = new Map<string, number>();

// ---- 全局 IPC 监听器 (只注册一次) ----
let globalListenerInitialized = false;

function ensureGlobalListener() {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;

  window.electron.ipcRenderer.on(
    SSE_TICK_DETAILS_DATA_CHANNEL,
    (_event, message: { secid: string; data: SseTickDetailsResponse }) => {
      const { secid, data } = message;
      const cbs = callbacks.get(secid);
      if (cbs) {
        cbs.forEach((cb) => cb(data));
      }
    },
  );
}

// ---- 公共 API ----

/**
 * 启动指定 secid 的 SSE 连接。
 * 使用引用计数：只有第一个订阅者才会触发 IPC START。
 */
export function startTickDetailsSse(secid: string) {
  const count = subscriptionCount.get(secid) ?? 0;
  subscriptionCount.set(secid, count + 1);
  if (count === 0) {
    const cookie = getDefaultStore().get(envAtom).cookie;
    window.electron.ipcRenderer.send(RequestType.SSE_TICK_DETAILS_START, secid, cookie);
  }
}

/**
 * 停止指定 secid 的 SSE 连接。
 * 使用引用计数：只有最后一个订阅者才会触发 IPC STOP。
 * 不传 secid 则停止所有连接。
 */
export function stopTickDetailsSse(secid?: string) {
  if (secid) {
    const count = subscriptionCount.get(secid) ?? 0;
    if (count <= 1) {
      subscriptionCount.delete(secid);
      window.electron.ipcRenderer.send(RequestType.SSE_TICK_DETAILS_STOP, secid);
    } else {
      subscriptionCount.set(secid, count - 1);
    }
  } else {
    subscriptionCount.clear();
    window.electron.ipcRenderer.send(RequestType.SSE_TICK_DETAILS_STOP);
  }
}

/**
 * 注册指定 secid 的 SSE 数据回调。
 * 返回一个取消订阅函数，调用后会自动清理。
 */
export function onTickDetailsData(secid: string, callback: TickCallback): () => void {
  ensureGlobalListener();

  if (!callbacks.has(secid)) {
    callbacks.set(secid, new Set());
  }
  callbacks.get(secid)!.add(callback);

  return () => {
    const cbs = callbacks.get(secid);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) {
        callbacks.delete(secid);
      }
    }
  };
}
