const BASE_URL = "https://api.binance.com/api/v3";
const QUOTE = "USDT";

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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance responded ${res.status}`);
  return res.json() as Promise<T>;
}

const toLevel = ([price, amount]: [string, string]): DepthLevel => ({
  price: Number(price),
  amount: Number(amount),
});

/** 바이낸스 {심볼}/USDT 마켓의 호가와 최근 체결. 마켓이 없으면 null. */
export async function getMarketDepth(symbol: string, depth = 5, tradeLimit = 30): Promise<MarketDepth | null> {
  const base = symbol.toUpperCase();
  if (base === QUOTE) return null;
  const pair = `${base}${QUOTE}`;

  try {
    const [book, trades] = await Promise.all([
      get<RawDepth>(`/depth?symbol=${pair}&limit=${depth}`),
      get<RawTrade[]>(`/trades?symbol=${pair}&limit=${tradeLimit}`),
    ]);

    return {
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
    };
  } catch (error) {
    console.warn(
      `[binance] ${pair} 호가/체결을 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
