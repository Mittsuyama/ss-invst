import { getDefaultStore } from 'jotai';
import { toast } from 'sonner';
import { RequestType } from '@shared/types/request';
import type { Pivot, PriceAndVolumeItem, Stroke } from '@shared/types/stock';
import { envAtom } from '@/models/detail';

export async function request(
  type: RequestType.GET | RequestType.POST,
  url: string,
  params?: Record<string, unknown>,
  headers?: Record<string, unknown>,
) {
  const env = getDefaultStore().get(envAtom);
  const mergedHeaders = { ...headers, cookie: env.cookie || headers?.cookie };
  const res = await window.electron.ipcRenderer.invoke(type, url, params, mergedHeaders);
  if (res.code === 0) {
    return res.data;
  }
  toast.error(res.message);
  throw new Error(res.message);
}

/** LIST_GET 的单项返回：code 非 0 视为失败（message 说明原因），成功时取 data */
interface ListGetItemResult {
  code: number;
  message: string;
  data: unknown;
}

export async function listGetRequest(
  list: Array<{ url: string; params: unknown }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<any>> {
  const res = (await window.electron.ipcRenderer.invoke(
    RequestType.LIST_GET,
    list,
  )) as ListGetItemResult[];
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
