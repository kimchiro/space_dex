import type { Candle, CandlesResponse, IntervalKey } from "@/lib/market/candles";

const BASE_URL = "https://api.binance.com/api/v3";
const QUOTE = "USDT";
const KLINES_PAGE = 1000;

export type DepthLevel = { price: number; amount: number };

export type Trade = {
  id: number;
  price: number;
  amount: number;
  time: number;
  side: "buy" | "sell";
};

export type MarketDepth = {
  pair: string;
  asks: DepthLevel[];
  bids: DepthLevel[];
  trades: Trade[];
};

type RawDepth = { asks: [string, string][]; bids: [string, string][] };
type RawTrade = { id: number; price: string; qty: string; time: number; isBuyerMaker: boolean };

export type MarketDepthResult = { supported: false } | { supported: true; depth: MarketDepth | null };

class BinanceError extends Error {
  constructor(public readonly status: number) {
    super(`Binance responded ${status}`);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new BinanceError(res.status);
  return res.json() as Promise<T>;
}

const toLevel = ([price, amount]: [string, string]): DepthLevel => ({
  price: Number(price),
  amount: Number(amount),
});

/**
 * 바이낸스 {심볼}/USDT 마켓의 호가와 최근 체결.
 * 마켓이 없으면 supported: false, 일시적으로 실패하면 depth: null.
 */
export async function getMarketDepth(symbol: string, depth = 5, tradeLimit = 30): Promise<MarketDepthResult> {
  const base = symbol.toUpperCase();
  if (base === QUOTE) return { supported: false };
  const pair = `${base}${QUOTE}`;

  try {
    const [book, trades] = await Promise.all([
      get<RawDepth>(`/depth?symbol=${pair}&limit=${depth}`),
      get<RawTrade[]>(`/trades?symbol=${pair}&limit=${tradeLimit}`),
    ]);

    return {
      supported: true,
      depth: {
        pair: `${base}/${QUOTE}`,
        asks: book.asks.map(toLevel),
        bids: book.bids.map(toLevel),
        trades: trades
          .map((t) => ({
            id: t.id,
            price: Number(t.price),
            amount: Number(t.qty),
            time: t.time,
            side: t.isBuyerMaker ? ("sell" as const) : ("buy" as const),
          }))
          .reverse(),
      },
    };
  } catch (error) {
    // 바이낸스는 없는 마켓에 400(Invalid symbol)을 돌려준다.
    if (error instanceof BinanceError && error.status === 400) return { supported: false };
    console.warn(
      `[binance] ${pair} 호가/체결을 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { supported: true, depth: null };
  }
}

type RawKline = [number, string, string, string, string, string, ...unknown[]];

const toCandle = (k: RawKline): Candle => ({
  time: k[0] / 1000,
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
});

export type KlinesRange = { limit: number; start?: number; end?: number };

/**
 * 바이낸스 {심볼}/USDT 캔들. start(ms)가 있으면 그 시점부터 앞으로, 없으면 end(기본 현재)부터 과거로 limit개를 모은다.
 * 한 번에 1000개까지만 주므로 여러 번 나눠 요청한다.
 */
export async function getKlines(symbol: string, interval: IntervalKey, range: KlinesRange): Promise<CandlesResponse> {
  const base = symbol.toUpperCase();
  if (base === QUOTE) return { supported: false };
  const pair = `${base}${QUOTE}`;
  const query = (params: Record<string, number | string>) =>
    `/klines?${new URLSearchParams({ symbol: pair, interval, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })}`;

  try {
    const candles: Candle[] = [];
    if (range.start !== undefined) {
      let cursor = range.start;
      while (candles.length < range.limit) {
        const page = await get<RawKline[]>(
          query({
            startTime: cursor,
            limit: Math.min(KLINES_PAGE, range.limit - candles.length),
            ...(range.end !== undefined ? { endTime: range.end } : {}),
          }),
        );
        candles.push(...page.map(toCandle));
        if (page.length < KLINES_PAGE) break;
        cursor = page[page.length - 1][0] + 1;
      }
    } else {
      let cursor = range.end;
      while (candles.length < range.limit) {
        const page = await get<RawKline[]>(
          query({
            limit: Math.min(KLINES_PAGE, range.limit - candles.length),
            ...(cursor !== undefined ? { endTime: cursor } : {}),
          }),
        );
        candles.unshift(...page.map(toCandle));
        if (page.length < KLINES_PAGE) break;
        cursor = page[0][0] - 1;
      }
    }
    return { supported: true, candles };
  } catch (error) {
    if (error instanceof BinanceError && error.status === 400) return { supported: false };
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[binance] ${pair} ${interval} 캔들을 불러오지 못했습니다: ${message}`);
    return { supported: true, candles: [], error: "캔들 데이터를 불러오지 못했어요." };
  }
}
