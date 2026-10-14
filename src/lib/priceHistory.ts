import { cacheLife } from "next/cache";
import { coingeckoFetch, describeError, getSnapshot, setSnapshot } from "./coingeckoFetch";

export type PricePoint = [time: number, price: number];

export const CHART_DAYS = [1, 7, 30, 90, 365] as const;
export type ChartDays = (typeof CHART_DAYS)[number];

const MAX_POINTS = 160;

function downsample(points: PricePoint[]) {
  if (points.length <= MAX_POINTS) return points;
  const step = (points.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)]);
}

/** 코인게코 가격 히스토리. 1일 차트는 1분, 그 외는 1시간 단위로 갱신된다. */
export async function getPriceHistory(coinId: string, days: ChartDays): Promise<PricePoint[] | null> {
  "use cache";
  if (days === 1) {
    cacheLife("minutes");
  } else {
    cacheLife("hours");
  }

  const key = `chart:${coinId}:${days}`;
  try {
    const { prices } = await coingeckoFetch<{ prices: PricePoint[] }>(
      `/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
    );
    if (!prices?.length) throw new Error("empty price history");
    const points = downsample(prices);
    setSnapshot(key, points);
    return points;
  } catch (error) {
    console.warn(`[chart] ${coinId} ${days}일 가격 히스토리를 불러오지 못했습니다: ${describeError(error)}`);
    return getSnapshot<PricePoint[]>(key) ?? null;
  }
}
