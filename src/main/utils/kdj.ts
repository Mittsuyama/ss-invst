export const computeKdj = (
  close: number[],
  low: number[],
  high: number[],
  n = 9,
  m1 = 3,
  m2 = 3,
) => {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];
  const rsv: number[] = [];
  for (let i = 0; i < close.length; i++) {
    const c = close[i];
    const hh = Math.max(...high.slice(i - n + 1, i + 1));
    const ll = Math.min(...low.slice(i - n + 1, i + 1));
    const tmp = ((c - ll) / (hh - ll)) * 100;
    const r = Number.isNaN(tmp) ? 50 : tmp;
    rsv.push(r);
    if (i < n - 1) {
      k.push(0);
      d.push(0);
      j.push(0);
    } else if (i === n - 1) {
      const avg = rsv.reduce((a, b) => a + b) / n;
      k.push(avg);
      d.push(avg);
      j.push(avg);
    } else {
      const kv = ((m1 - 1) / m1) * k[i - 1] + (1 / m1) * r;
      const dv = ((m2 - 1) / m2) * d[i - 1] + (1 / m2) * kv;
      const jv = 3 * kv - 2 * dv;
      k.push(kv);
      d.push(dv);
      j.push(jv);
    }
  }

  return {
    k,
    d,
    j,
    rsv,
  };
};
