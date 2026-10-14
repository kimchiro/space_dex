import { cacheLife } from "next/cache";

export type PricePoint = [time: number, price: number];

export const CHART_DAYS = [1, 7, 30, 90, 365] as const;
export type ChartDays = (typeof CHART_DAYS)[number];

const MAX_POINTS = 160;

function downsample(points: PricePoint[]) {
  if (points.length <= MAX_POINTS) return points;
  const step = (points.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)]);
}

const lastSuccessful = new Map<string, PricePoint[]>();

/** 코인게코 가격 히스토리. 1일 차트는 1분, 그 외는 1시간 단위로 갱신된다. */
export async function getPriceHistory(coinId: string, days: ChartDays): Promise<PricePoint[] | null> {
  "use cache";
  if (days === 1) {
    cacheLife("minutes");
  } else {
    cacheLife("hours");
  }

  const key = `${coinId}:${days}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
      { headers },
    );
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const { prices } = (await res.json()) as { prices: PricePoint[] };
    if (!prices?.length) throw new Error("empty price history");
    const points = downsample(prices);
    lastSuccessful.set(key, points);
    return points;
  } catch (error) {
    console.error(`[chart] ${key} 가격 히스토리를 불러오지 못했습니다.`, error);
    return lastSuccessful.get(key) ?? null;
  }
}
