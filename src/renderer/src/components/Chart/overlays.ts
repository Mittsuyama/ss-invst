import { OverlayCreate } from 'klinecharts';
import { PeriodType, PriceAndVolumeItem } from '@shared/types/stock';
import { NEED_SEGMENTS_PERIOD } from '@/lib/constants';
import {
  computePivotWithDp,
  computeSegmentsSimply,
  computeStrokeSimply,
} from '@shared/lib/chanlun';
import { STROKE_COLOR, SEGEMENT_COLOR, UP_PIVOT_COLOR, DOWN_PIVOT_COLOR } from './helper';

/**
 * 基于缠论算法计算笔、线段与中枢，并转换为 klinecharts overlay。
 * （pinbar 的计算与回测见 ./pinbar）
 */
export function buildChanlunOverlays(
  list: PriceAndVolumeItem[],
  period: PeriodType,
  visible: boolean,
): OverlayCreate[] {
  const needSegments = NEED_SEGMENTS_PERIOD.includes(period);
  const strokes = computeStrokeSimply(list);
  const segments = needSegments ? computeSegmentsSimply(strokes) : [];
  const pivots = computePivotWithDp(needSegments ? segments : strokes);

  return [
    ...strokes.map(
      (s): OverlayCreate => ({
        visible,
        name: 'segment',
        paneId: 'candle_pane',
        lock: true,
        points: [
          { timestamp: s.start.timestamp, value: s.start.price },
          { timestamp: s.end.timestamp, value: s.end.price },
        ],
        styles: {
          line: {
            size: 1,
            color: STROKE_COLOR,
          },
        },
      }),
    ),
    ...segments.map(
      (s): OverlayCreate => ({
        visible,
        name: 'segment',
        paneId: 'candle_pane',
        lock: true,
        points: [
          { timestamp: s.start.timestamp, value: s.start.price },
          { timestamp: s.end.timestamp, value: s.end.price },
        ],
        styles: {
          line: {
            size: 2,
            color: SEGEMENT_COLOR,
          },
        },
      }),
    ),
    ...pivots.map(
      (p): OverlayCreate => ({
        visible,
        name: 'pivot',
        paneId: 'candle_pane',
        lock: true,
        points: [
          { timestamp: p.start, value: p.low },
          { timestamp: p.end, value: p.high },
        ],
        styles: {
          color: p.type === 'up' ? UP_PIVOT_COLOR : DOWN_PIVOT_COLOR,
        },
      }),
    ),
  ];
}
