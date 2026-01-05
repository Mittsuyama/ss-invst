import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { HistoryOption } from '@/types/search';

export const historySearchOptionsAtom = atomWithStorage(
  'history-search-options',
  [] as HistoryOption[],
  undefined,
  { getOnInit: true },
);

export const searchOpenAtom = atom(false);
