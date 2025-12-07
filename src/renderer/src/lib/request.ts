import { toast } from 'sonner';
import { RequestType } from '@shared/types/request';
import type { Pivot, PriceAndVolumeItem, Stroke } from '@shared/types/stock';

export async function request(
  type: RequestType.GET,
  url: string,
  params?: Record<string, unknown>,
) {
  const res = await window.electron.ipcRenderer.invoke(type, url, params);
  if (res.code === 0) {
    return res.data;
  }
  toast.error(res.message);
  throw new Error(res.message);
}

export async function listGetRequest(list: Array<{ url: string; params: unknown }>) {
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
  console.log(res);
  return res as { strokes: Stroke[]; pivots: Pivot[] };
}
