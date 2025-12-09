import { ChartType, PeriodType } from '@shared/types/stock';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { Direction } from '@shared/types/meta';

export const currentStockIdAtom = atom<string>('');
export const chartTypeAtom = atomWithStorage<ChartType>(
  'stock-detail-chart-type',
  ChartType.DAY,
  undefined,
  {
    getOnInit: true,
  },
);
export const favStockIdListAtom = atomWithStorage<Array<string>>(
  'fav-stock-id-list',
  [],
  undefined,
  {
    getOnInit: true,
  },
);
export const chanlunVisibleAtom = atomWithStorage<boolean>('chanlun-visible', true, undefined, {
  getOnInit: true,
});
export const quickNavDirectionAtom = atomWithStorage<Direction | null>(
  'quick-nav-direction',
  null,
  undefined,
  {
    getOnInit: true,
  },
);
export const scaleInPeriodAtom = atomWithStorage<Partial<Record<PeriodType, number>>>(
  'scale-in-period',
  {},
  undefined,
  {
    getOnInit: true,
  },
);
