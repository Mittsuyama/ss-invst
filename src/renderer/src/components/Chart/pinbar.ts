/**
 * Pinbar 回测区间的 klinecharts overlay 适配层。
 *
 * 形态识别与移动止损回测在 @shared/lib/pinbar（与 agent 因子共用同一份实现），
 * 本文件只负责把 PinbarRecord 转成图表矩形。
 */

import { OverlayCreate } from 'klinecharts';
import { PriceAndVolumeItem } from '@shared/types/stock';
import { computePinbars, formatPercent, PinbarOptions, PinbarResultType } from '@shared/lib/pinbar';

export type {
  PinbarDirection,
  PinbarOptions,
  PinbarResultType,
  PinbarStopMode,
} from '@shared/lib/pinbar';

/** 区间矩形颜色：失败 = 灰、成功 = 蓝、进行中 = 黄（浅色底由 figure 派生） */
const PINBAR_RANGE_COLORS: Record<PinbarResultType, string> = {
  failed: '#8c8c8c',
  success: '#2196f3',
  'in-progress': '#e6b800',
};

/** 构建 pinbar 回测区间矩形 overlay：从 pinbar 左侧边起，到止损 K 线结束。 */
export function buildPinbarOverlays(
  list: PriceAndVolumeItem[],
  options: PinbarOptions,
  visible = true,
): OverlayCreate[] {
  return computePinbars(list, options).map((record): OverlayCreate => {
    const pinbar = list[record.index];
    const end = list[record.endIndex];
    const isLong = record.direction === 'long';
    // 做多：从 pinbar 最低点到止损 K 线最高点；做空相反（pinbar 最高点到止损 K 线最低点）
    const top = isLong ? end.high : pinbar.high;
    const bottom = isLong ? pinbar.low : end.low;
    return {
      visible,
      name: 'pinbarRange',
      paneId: 'candle_pane',
      lock: true,
      points: [
        { timestamp: pinbar.timestamp, value: top },
        { timestamp: end.timestamp, value: bottom },
      ],
      styles: {
        color: PINBAR_RANGE_COLORS[record.result],
      },
      // 盈亏比例文本，展示在矩形右下角
      extendData: formatPercent(record.profit),
    };
  });
}
