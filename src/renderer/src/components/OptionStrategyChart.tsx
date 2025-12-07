import { memo, useState, useEffect, useMemo } from 'react';
import { AreaChart } from '@visactor/react-vchart';
import type { IMarkPointSpec } from '@visactor/vchart';
import { OptionItem } from '@shared/types/option';

type O = OptionItem & { direction: 'buy' | 'sell'; count: number };

interface Point {
  price: number;
  profit: number;
}

interface OptionStrategyChartProps {
  selectedOption: O[];
}

export const OptionStrategyChart = memo((props: OptionStrategyChartProps) => {
  const { selectedOption } = props;

  const [optionValues, setOptionValues] = useState<Array<Point>>([]);
  const [zeroPoint, setZeroPoint] = useState<Array<number>>([]);
  const [range, setRange] = useState<{ min: Point; max: Point } | null>(null);

  useEffect(() => {
    if (!selectedOption.some((item) => item.count !== 0)) {
      setRange(null);
      setOptionValues([]);
      setZeroPoint([]);
      return;
    }
    const currentPrice = selectedOption[0].underlyingPrice * 10;
    const values: Array<{ price: number; profit: number }> = [];
    const range = Math.round(currentPrice / 3);
    for (let p = Math.max(currentPrice - range, 0); p <= currentPrice + range; p++) {
      const profit = selectedOption.reduce((acc, item) => {
        const { type, direction, price, count } = item;
        const strike = item.strike * 10;
        if (direction === 'buy') {
          if (type === 'call') {
            return acc + (Math.max(p - strike, 0) - price) * count;
          }
          return acc + (Math.max(strike - p, 0) - price) * count;
        }
        if (direction === 'sell') {
          if (type === 'call') {
            return acc - (Math.max(p - strike, 0) - price) * count;
          }
          return acc - (Math.max(strike - p, 0) - price) * count;
        }
        return acc;
      }, 0);
      values.push({
        price: p,
        profit,
      });
    }

    let min: Point = { price: 0, profit: Number.MAX_SAFE_INTEGER };
    let max: Point = { price: 0, profit: Number.MIN_SAFE_INTEGER };
    const zeros: Array<number> = [];
    // 找零点
    for (let i = 0; i < values.length; i++) {
      if (values[i].profit > max.profit) {
        max = { price: values[i].price, profit: values[i].profit };
      }
      if (values[i].profit < min.profit) {
        min = { price: values[i].price, profit: values[i].profit };
      }
      if (values[i].profit === 0) {
        zeros.push(values[i].price);
        continue;
      }
      // 异号
      if (i > 0 && values[i].profit * values[i - 1].profit < 0) {
        zeros.push(values[i].profit * -1 + values[i].price);
      }
    }
    setRange({ min, max });
    setZeroPoint(zeros);
    setOptionValues(values);
  }, [selectedOption]);

  const markPoint = useMemo(() => {
    const res: IMarkPointSpec[] = [];

    const genPoint = (
      price: number,
      profit: number,
      value: number,
      title: string,
      color: string,
    ): IMarkPointSpec => ({
      coordinate: {
        price,
        profit,
      },
      itemContent: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'richText' as any,
        // @ts-ignore itemContent does have this attribute
        autoRotate: false,
        confine: true,
        richText: {
          style: {
            height: 80,
            textConfig: [
              {
                text: `${value}\n`,
                fill: color,
                fontWeight: 'bold',
                lineHeight: 26,
                fontSize: 16,
              },
              {
                text: title,
                fill: color,
                fontSize: 12,
              },
            ],
          },
        },
      },
      itemLine: {
        startSymbol: {
          visible: true,
          size: 8,
          style: {
            fill: color,
          },
        },
        line: {
          style: {
            stroke: color,
            lineDash: [4, 4],
          },
        },
      },
    });
    if (range) {
      res.push(genPoint(range.min.price, range.min.profit, range.min.profit, '最小值', '#6adfa5'));
      res.push(genPoint(range.max.price, range.max.profit, range.max.profit, '最大值', '#de6271'));
    }
    zeroPoint.forEach((v) => {
      res.push(genPoint(v, 0, v, '盈亏平衡点', '#3b76d6'));
    });
    return res;
  }, [zeroPoint, range]);

  if (!optionValues.length) {
    return null;
  }

  return (
    <AreaChart
      spec={{
        height: 400,
        type: 'area',
        data: {
          values: optionValues,
        },
        padding: {
          top: 30,
        },
        line: {
          style: {
            stroke: (data) => {
              if (data.profit > 0) {
                return '#ee7e8b';
              }
              return '#8bedbc';
            },
          },
        },
        area: {
          style: {
            fill: (data) => {
              if (data.profit > 0) {
                return '#ee7e8b22';
              }
              return '#8bedbc22';
            },
          },
        },
        markPoint,
        markLine: [
          {
            x: selectedOption[0].underlyingPrice * 10,
            label: {
              text: `标的现价 ${selectedOption[0].underlyingPrice * 10}`,
              style: {
                fill: 'white',
              },
              refY: 0,
              refX: 10,
              labelBackground: {
                padding: 5,
                style: {
                  fill: '#333',
                },
              },
            },
            line: {
              style: {
                lineWidth: 1,
                stroke: '#333',
                lineDash: [4, 4],
              },
            },
            endSymbol: {
              visible: false,
            },
          },
          {
            y: 0,
            label: {
              visible: false,
            },
            line: {
              style: {
                lineWidth: 2,
                stroke: '#333',
                lineDash: [0, 0],
              },
            },
            endSymbol: {
              visible: false,
            },
          },
        ],
        crosshair: {
          xField: {
            visible: true,
            line: {
              type: 'line',
              style: {
                lineWidth: 1,
                stroke: '#555',
                lineDash: [3, 3],
              },
            },
            label: {
              visible: true,
            },
          },
          yField: {
            visible: true,
            line: {
              type: 'line',
              style: {
                lineWidth: 1,
                stroke: '#555',
                lineDash: [3, 3],
              },
            },
            label: {
              visible: true,
            },
          },
        },
        axes: [
          {
            orient: 'bottom',
            tick: {
              tickCount: 10,
            },
          },
          {
            orient: 'left',
            grid: {
              visible: true,
              style: {
                stroke: '#aaaaaa33',
              },
            },
          },
        ],
        point: {
          visible: false,
        },
        xField: 'price',
        yField: 'profit',
      }}
    />
  );
});

OptionStrategyChart.displayName = 'OptionStrategyChart';
