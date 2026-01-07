export type ThemeType = 'auto' | 'light' | 'dark';

export enum RouterKey {
  /** 首页 */
  HOME = '/home',

  /** 自选股 */
  CHOICE = '/choice',

  /** 筛股 */
  FILTER = '/filter',

  /** 期权 */
  OPTION = '/option',

  /** 实时 */
  REALTIME = '/realtime',

  /** 设置 */
  SETTINGS = '/settings',

  /** 自选股看板 */
  CHOICE_OVERVIEW = '/choice-overview/:id',
}
