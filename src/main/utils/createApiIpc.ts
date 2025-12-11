import { ipcMain } from 'electron';
import { RequestType } from '@shared/types/request';
import type { PriceAndVolumeItem } from '@shared/types/stock';
import { computePivotWithDp, computeStrokeSimply } from '@shared/lib/chanlun';
import { axiosGet, axiosPost } from './axios';

export const createApiIpc = () => {
  ipcMain.handle(RequestType.GET, async (_, url: string, params: unknown) => {
    return await axiosGet(url, params);
  });

  ipcMain.handle(RequestType.POST, async (_, url: string, params: unknown) => {
    return await axiosPost(url, params);
  });

  ipcMain.handle(RequestType.LIST_GET, async (_, list: Array<{ url: string; params: unknown }>) => {
    const resList = await Promise.all(list.map((item) => axiosGet(item.url, item.params)));
    return resList;
  });

  ipcMain.handle(RequestType.CHANLUN_COMPUTE, async (_, list: PriceAndVolumeItem[]) => {
    const strokes = computeStrokeSimply(list);
    const pivots = computePivotWithDp(strokes);
    return {
      strokes,
      pivots,
    };
  });
};
