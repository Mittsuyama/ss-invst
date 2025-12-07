import { HistoryOption } from '@/types/search';
import { atomWithStorage } from 'jotai/utils';

export const historySearchOptionsAtom = atomWithStorage(
  'history-search-options',
  [] as HistoryOption[],
  undefined,
  { getOnInit: true },
);
