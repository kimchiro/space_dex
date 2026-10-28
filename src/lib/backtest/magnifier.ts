import { intervalSeconds, lowerIntervalFor, type Candle, type IntervalKey } from "@/lib/market/candles";
import { fetchCandles } from "@/lib/market/useCandles";
import { runBacktest, type BacktestInput, type BacktestResult } from "./engine";

/** 한 번의 백테스트에서 하위 봉을 받아올 최대 봉 수. 바이낸스 호출 한도를 넘지 않게 제한한다. */
export const MAX_MAGNIFIED_BARS = 150;
const CONCURRENCY = 4;
const MAX_ROUNDS = 3;

export type MagnifierReport = {
  lowerInterval: IntervalKey | null;
  /** 하위 봉을 받아 순서를 정한 봉 */
  resolved: number[];
  /** 하위 봉이 없거나 한도를 넘어 기본 규칙을 쓴 봉 */
  missing: number[];
  capped: boolean;
  /** 확보한 하위 봉 구간 */
  coverage: { from: number; to: number } | null;
};

async function fetchLowerBars(symbol: string, lower: IntervalKey, barTime: number, barSeconds: number): Promise<Candle[]> {
  const count = Math.ceil(barSeconds / intervalSeconds(lower));
  const result = await fetchCandles({ symbol, interval: lower, start: barTime * 1000, end: (barTime + barSeconds) * 1000 - 1, limit: count });
  return result.supported ? result.candles.filter((c) => c.time >= barTime && c.time < barTime + barSeconds) : [];
}

/**
 * 일반 모드로 먼저 실행하고, 손절·익절 순서가 불명확한 봉만 하위 시간봉을 받아 다시 실행한다.
 * 다시 실행하면 거래 흐름이 바뀌어 새 봉이 생길 수 있어 최대 3번 반복한다.
 */
export async function runWithMagnifier(
  input: BacktestInput & { symbol: string; interval: IntervalKey },
  onProgress?: (done: number, total: number) => void,
): Promise<{ result: BacktestResult; report: MagnifierReport }> {
  const lower = lowerIntervalFor(input.interval);
  const subBars = new Map<number, Candle[]>();
  let result = runBacktest(input);
  const report: MagnifierReport = { lowerInterval: lower, resolved: [], missing: [], capped: false, coverage: null };
  if (!lower) {
    report.missing = result.ambiguousBars;
    return { result, report };
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const wanted = result.ambiguousBars.filter((t) => !subBars.has(t));
    if (!wanted.length) break;
    const room = MAX_MAGNIFIED_BARS - subBars.size;
    if (room <= 0) {
      report.capped = true;
      break;
    }
    const batch = wanted.slice(0, room);
    if (batch.length < wanted.length) report.capped = true;

    let done = 0;
    for (let k = 0; k < batch.length; k += CONCURRENCY) {
      const chunk = batch.slice(k, k + CONCURRENCY);
      const fetched = await Promise.all(
        chunk.map((t) => fetchLowerBars(input.symbol, lower, t, input.intervalSeconds).catch(() => [] as Candle[])),
      );
      chunk.forEach((t, j) => subBars.set(t, fetched[j]));
      done += chunk.length;
      onProgress?.(done, batch.length);
    }
    result = runBacktest({ ...input, subBars });
  }

  report.resolved = result.magnifiedBars;
  report.missing = result.ambiguousBars;
  const covered = [...subBars.values()].flat();
  if (covered.length) {
    report.coverage = { from: Math.min(...covered.map((c) => c.time)), to: Math.max(...covered.map((c) => c.time)) };
  }
  return { result, report };
}
