import { getDefaultStore } from 'jotai';
import { toast } from 'sonner';
import { RequestType } from '@shared/types/request';
import type { Pivot, PriceAndVolumeItem, Stroke } from '@shared/types/stock';
import { cookieAtom } from '@/models/detail';

export async function request(
  type: RequestType.GET | RequestType.POST,
  url: string,
  params?: Record<string, unknown>,
  headers?: Record<string, unknown>,
) {
  const cookie = getDefaultStore().get(cookieAtom);
  const mergedHeaders = { ...headers, cookie: cookie || headers?.cookie };
  const res = await window.electron.ipcRenderer.invoke(type, url, params, mergedHeaders);
  if (res.code === 0) {
    return res.data;
  }
  toast.error(res.message);
  throw new Error(res.message);
}

export async function listGetRequest(
  list: Array<{ url: string; params: unknown }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<any>> {
  const res = await window.electron.ipcRenderer.invoke(RequestType.LIST_GET, list);
  const error = res.find((item) => item.code !== 0);
  if (error) {
    toast.error(error.message);
    throw new Error(error.message);
  }
  return res.map((item) => item.data);
}

export async function chanlunComputeRequest(list: PriceAndVolumeItem[]) {
  const res = await window.electron.ipcRenderer.invoke(RequestType.CHANLUN_COMPUTE, list);
  return res as { strokes: Stroke[]; pivots: Pivot[] };
}
