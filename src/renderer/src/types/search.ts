import { ReactNode, FC } from 'react';
import { RouterKey } from './global';

export interface RouterOption {
  type: 'router';
  title: string;
  Icon: FC<{ size: number }>;
  extra: ReactNode;
  path: RouterKey;
}

export interface SecOption {
  type: 'sec';
  title: string;
  id: string;
  exchange: string;
}

export type HistoryOption = Omit<SecOption, 'type'> & {
  type: 'history';
};

export interface CustomOption {
  type: 'custom';
  id: string;
  content: ReactNode;
}

export interface FilterItem {
  id: string;
  code: string;
  name: string;
  price: number;
  chg: number;
  totalMarketValue: number;
  biz: string;
  kdj_day: number;
  kdj_week: number;
  kdj_half_hour: number;
  kdj_fifteen_minute: number;
}

export interface FilterColumn {
  key: string;
  title: string;
}
