/**
 * 차트·Pine 런타임이 함께 쓰는 지표 계산. 값이 없는 구간은 NaN.
 * TradingView Pine의 ta.* 정의(초기값 포함)를 따른다.
 */

export function sma(values: number[], length: number) {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

/** ta.ema: 첫 length개 단순평균을 시작값으로 쓴다. */
export function ema(values: number[], length: number) {
  return smoothed(values, length, 2 / (length + 1));
}

/** ta.rma (와일더 평활) */
export function rma(values: number[], length: number) {
  return smoothed(values, length, 1 / length);
}

function smoothed(values: number[], length: number, alpha: number) {
  const out = new Array<number>(values.length).fill(NaN);
  let prev = NaN;
  let seed = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(prev)) {
      seed += v;
      count++;
      if (count === length) prev = seed / length;
    } else {
      prev = alpha * v + (1 - alpha) * prev;
    }
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], length: number) {
  const gains = values.map((v, i) => (i === 0 ? NaN : Math.max(v - values[i - 1], 0)));
  const losses = values.map((v, i) => (i === 0 ? NaN : Math.max(values[i - 1] - v, 0)));
  const up = rma(gains, length);
  const down = rma(losses, length);
  return up.map((u, i) => {
    const d = down[i];
    if (Number.isNaN(u) || Number.isNaN(d)) return NaN;
    if (d === 0) return 100;
    if (u === 0) return 0;
    return 100 - 100 / (1 + u / d);
  });
}

/** ta.stdev: 모표준편차 */
export function stdev(values: number[], length: number) {
  const mean = sma(values, length);
  return values.map((_, i) => {
    if (Number.isNaN(mean[i])) return NaN;
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += (values[j] - mean[i]) ** 2;
    return Math.sqrt(sum / length);
  });
}

export function bollinger(values: number[], length: number, mult: number) {
  const basis = sma(values, length);
  const dev = stdev(values, length);
  return {
    basis,
    upper: basis.map((b, i) => b + mult * dev[i]),
    lower: basis.map((b, i) => b - mult * dev[i]),
  };
}
