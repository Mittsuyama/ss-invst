import { registerOverlay, registerFigure, registerIndicator, IndicatorSeries } from 'klinecharts';
import { BarSpace } from '@/types/global';

export const STROKE_COLOR = '#888888DD';
export const SEGEMENT_COLOR = '#1875C1A1';
// const PIVOT_COLOR = '#00a6ff';
export const UP_PIVOT_COLOR = '#ff8000';
export const DOWN_PIVOT_COLOR = '#a6ff00';

export const MA_COLORS = ['#888', '#00d9ffaa', '#000dff87', '#a600ff87', '#ff00a287'];
export const DARK_MA_COLORS = ['white', 'yellow', 'violet', '#a600ff87', '#ff00a287'];
export const KDJ_COLORS = ['#868686c5', '#ffb700', '#f700ffa8'];
export const DARK_KDJ_COLORS = ['white', 'yellow', 'violet'];

export interface PivotAttrs {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PivotStyles {
  color: string;
  extended?: boolean;
}

registerFigure<PivotAttrs, PivotStyles>({
  name: 'pivot',
  draw: (ctx, attrs, styles) => {
    const { x1, y1, x2, y2 } = attrs;
    const { color, extended } = styles;
    ctx.beginPath();
    ctx.strokeStyle = `${color}ee`;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = `${color}33`;
    if (extended) {
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = `${color}aa`;
      ctx.fillStyle = `${color}11`;
    }
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  },
  checkEventOn: ({ x, y }, attrs, styles) => {
    if (styles.extended) {
      return false;
    }
    const { x1, y1, x2, y2 } = attrs;
    const xRange = [x1, x2].sort((a, b) => a - b);
    const yRange = [y1, y2].sort((a, b) => a - b);
    return x >= xRange[0] && x <= xRange[1] && y >= yRange[0] && y <= yRange[1];
  },
});

registerOverlay({
  name: 'pivot',
  totalStep: 3,
  lock: true,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay }) => {
    return {
      type: 'pivot',
      attrs: {
        x1: coordinates[0].x,
        y1: coordinates[0].y,
        x2: coordinates[1].x,
        y2: coordinates[1].y,
      },
      styles: overlay.styles,
    };
  },
});

registerIndicator({
  name: 'ZX-TREND',
  shortName: 'ZX-TREND',
  series: IndicatorSeries.Price,
  calcParams: [14, 28, 47, 144],
  figures: [
    {
      key: 'short',
      title: 'SHORT',
      type: 'line',
    },
    {
      key: 'long',
      title: 'LONG',
      type: 'line',
    },
  ],
  calc: (dataList, indicator) => {
    const { calcParams: params } = indicator;
    let ema = 0;
    let ema2 = 0;
    const sum = params.map(() => 0);
    return dataList.map((data, index) => {
      ema = (1 - 2 / 10) * ema + (2 / 10) * data.close;
      ema2 = (1 - 2 / 10) * ema2 + (2 / 10) * ema;
      params.forEach((p, i) => {
        if (index < p) {
          sum[i] += data.close;
        } else {
          sum[i] = sum[i] - dataList[index - p].close + data.close;
        }
      });
      const ma = sum.map((s, i) => s / params[i]);
      return {
        short: ema2,
        long: ma.reduce((a, b) => a + b) / ma.length,
      };
    });
  },
});

export const BAR_SPACE_SIZE: Record<BarSpace, number> = {
  [BarSpace.EXTRA_SMALL]: 1.25,
  [BarSpace.SMALL]: 2.98,
  [BarSpace.MEDIUM]: 5.76,
  [BarSpace.LARGE]: 8,
  [BarSpace.EXTRA_LARGE]: 12,
};

export const BAR_SPACE_TITLE: Record<BarSpace, string> = {
  [BarSpace.EXTRA_SMALL]: 'XS',
  [BarSpace.SMALL]: 'S',
  [BarSpace.MEDIUM]: 'M',
  [BarSpace.LARGE]: 'L',
  [BarSpace.EXTRA_LARGE]: 'XL',
};
