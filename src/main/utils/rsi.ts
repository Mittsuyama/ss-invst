export const computeRSI = (close: number[], n = 6) => {
  const rsi: number[] = [];
  const rs: number[] = [];

  let upSmooth = 0;
  let downSmooth = 0;
  for (let i = 1; i < n + 1; i++) {
    upSmooth += Math.max(close[i] - close[i - 1], 0);
    downSmooth += Math.max(close[i - 1] - close[i], 0);
  }
  upSmooth /= n;
  downSmooth /= n;
  rs.push(downSmooth ? upSmooth / downSmooth : 100);
  rsi.push(100 - 100 / (1 + rs[rs.length - 1]));

  for (let i = n + 1; i < close.length; i++) {
    upSmooth = (upSmooth * (n - 1) + Math.max(close[i] - close[i - 1], 0)) / n;
    downSmooth = (downSmooth * (n - 1) + Math.max(close[i - 1] - close[i], 0)) / n;
    rs.push(downSmooth ? upSmooth / downSmooth : 100);
    rsi.push(100 - 100 / (1 + rs[rs.length - 1]));
  }

  return rsi;
};
