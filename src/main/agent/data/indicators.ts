export function computeMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = round2(sum / period);
  }
  return out;
}

export function computeBOLL(values: number[], period = 20, mult = 2) {
  const mid: (number | null)[] = new Array(values.length).fill(null);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / period);
    mid[i] = round2(m);
    upper[i] = round2(m + mult * sd);
    lower[i] = round2(m - mult * sd);
  }
  return { mid, upper, lower };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
