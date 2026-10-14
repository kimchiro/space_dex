import { cacheLife } from "next/cache";
import { fallbackTokens, type Token } from "@/data/tokens";

const MARKETS_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";
const PER_PAGE = 100;
const SPARKLINE_POINTS = 42;

// 호출 제한(429) 등으로 실패하면 목업 대신 마지막 정상 응답을 돌려준다.
let lastSuccessfulTokens: Token[] | null = null;

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
};

const nativeChains: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB Chain",
  XRP: "XRP Ledger",
  ADA: "Cardano",
  TRX: "Tron",
  AVAX: "Avalanche",
  SUI: "Sui",
  TON: "TON",
  DOT: "Polkadot",
  NEAR: "NEAR",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  POL: "Polygon",
};

function colorFor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 62%, 52%)`;
}

function downsample(series: number[], points: number) {
  if (series.length <= points) return series;
  const step = (series.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => series[Math.round(i * step)]);
}

function toTokens(markets: CoinGeckoMarket[]): Token[] {
  const seen = new Set<string>();
  const result: Token[] = [];

  for (const m of markets) {
    const symbol = m.symbol.toUpperCase();
    if (m.current_price == null || seen.has(symbol)) continue;
    seen.add(symbol);

    result.push({
      id: m.id,
      symbol,
      name: m.name,
      chain: nativeChains[symbol],
      image: m.image,
      rank: m.market_cap_rank ?? undefined,
      price: m.current_price,
      change24h: m.price_change_percentage_24h ?? 0,
      volume24h: m.total_volume ?? 0,
      marketCap: m.market_cap ?? 0,
      color: colorFor(symbol),
      sparkline: m.sparkline_in_7d?.price.length
        ? downsample(m.sparkline_in_7d.price, SPARKLINE_POINTS)
        : undefined,
    });
  }

  return result;
}

/** 시가총액 상위 코인 시세. 서버에서 1분 단위로 갱신된다. */
export async function getMarketTokens(): Promise<Token[]> {
  "use cache";
  cacheLife("minutes");

  const params = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(PER_PAGE),
    page: "1",
    sparkline: "true",
    price_change_percentage: "24h",
    locale: "ko",
  });

  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await fetch(`${MARKETS_ENDPOINT}?${params}`, { headers });
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const tokens = toTokens((await res.json()) as CoinGeckoMarket[]);
    if (tokens.length === 0) throw new Error("CoinGecko returned no markets");
    lastSuccessfulTokens = tokens;
    return tokens;
  } catch (error) {
    console.error(
      `[coingecko] 시세를 불러오지 못해 ${lastSuccessfulTokens ? "마지막으로 받은 시세" : "목업 데이터"}를 사용합니다.`,
      error,
    );
    return lastSuccessfulTokens ?? fallbackTokens;
  }
}
