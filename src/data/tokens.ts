export type Token = {
  symbol: string;
  name: string;
  chain: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  color: string;
};

export const tokens: Token[] = [
  { symbol: "BTC", name: "비트코인", chain: "Ethereum", price: 98420.12, change24h: 2.34, volume24h: 3_820_000_000, marketCap: 1_940_000_000_000, color: "#f7931a" },
  { symbol: "ETH", name: "이더리움", chain: "Ethereum", price: 3712.56, change24h: 3.91, volume24h: 2_410_000_000, marketCap: 446_000_000_000, color: "#627eea" },
  { symbol: "SOL", name: "솔라나", chain: "Solana", price: 212.48, change24h: -1.27, volume24h: 1_120_000_000, marketCap: 101_000_000_000, color: "#14f195" },
  { symbol: "USDC", name: "USD 코인", chain: "Ethereum", price: 1.0, change24h: 0.01, volume24h: 980_000_000, marketCap: 44_000_000_000, color: "#2775ca" },
  { symbol: "USDT", name: "테더", chain: "Ethereum", price: 1.0, change24h: -0.02, volume24h: 1_540_000_000, marketCap: 120_000_000_000, color: "#26a17b" },
  { symbol: "BNB", name: "바이낸스 코인", chain: "BNB Chain", price: 642.3, change24h: 0.88, volume24h: 410_000_000, marketCap: 93_000_000_000, color: "#f3ba2f" },
  { symbol: "ARB", name: "아비트럼", chain: "Arbitrum", price: 0.8421, change24h: 7.42, volume24h: 320_000_000, marketCap: 3_400_000_000, color: "#28a0f0" },
  { symbol: "OP", name: "옵티미즘", chain: "Optimism", price: 1.932, change24h: 5.13, volume24h: 210_000_000, marketCap: 2_600_000_000, color: "#ff0420" },
  { symbol: "UNI", name: "유니스왑", chain: "Ethereum", price: 13.27, change24h: -3.66, volume24h: 260_000_000, marketCap: 8_000_000_000, color: "#ff007a" },
  { symbol: "LINK", name: "체인링크", chain: "Ethereum", price: 24.81, change24h: 1.95, volume24h: 390_000_000, marketCap: 15_600_000_000, color: "#2a5ada" },
  { symbol: "AAVE", name: "에이브", chain: "Ethereum", price: 342.9, change24h: -2.18, volume24h: 180_000_000, marketCap: 5_100_000_000, color: "#b6509e" },
  { symbol: "PEPE", name: "페페", chain: "Ethereum", price: 0.00001942, change24h: 12.67, volume24h: 870_000_000, marketCap: 8_170_000_000, color: "#479f53" },
  { symbol: "DOGE", name: "도지코인", chain: "BNB Chain", price: 0.3821, change24h: -5.04, volume24h: 640_000_000, marketCap: 56_000_000_000, color: "#c2a633" },
  { symbol: "SUI", name: "수이", chain: "Sui", price: 4.12, change24h: 9.21, volume24h: 520_000_000, marketCap: 12_300_000_000, color: "#4da2ff" },
  { symbol: "POL", name: "폴리곤", chain: "Polygon", price: 0.5234, change24h: -0.74, volume24h: 140_000_000, marketCap: 4_300_000_000, color: "#8247e5" },
];

export const findToken = (symbol: string) =>
  tokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());

export type MarketIndex = {
  label: string;
  value: string;
  change: number;
  seed: string;
};

export const marketIndices: MarketIndex[] = [
  { label: "DEX 총 예치금 (TVL)", value: "$21.84B", change: 1.82, seed: "tvl" },
  { label: "24시간 DEX 거래량", value: "$7.12B", change: 4.37, seed: "volume" },
  { label: "BTC 도미넌스", value: "57.3%", change: -0.42, seed: "dominance" },
  { label: "평균 가스비 (ETH)", value: "12 Gwei", change: -8.15, seed: "gas" },
];

export const chains = ["Ethereum", "Arbitrum", "Optimism", "Solana", "BNB Chain", "Polygon", "Sui"];

/** 심볼 기반 시드로 결정적인 가격 시계열을 만든다 (SSR/CSR 결과가 같아야 함). */
export function generateSeries(seed: string, length = 60, end = 100, volatility = 0.02) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 2 ** 32;
  };

  const series = [end];
  for (let i = 1; i < length; i++) {
    const prev = series[i - 1];
    series.push(prev * (1 + (rand() - 0.5) * 2 * volatility));
  }
  return series.reverse();
}

export type OrderLevel = { price: number; amount: number };

export function generateOrderBook(token: Token, depth = 8) {
  const series = generateSeries(`${token.symbol}-book`, depth * 2, 1, 0.5);
  const tick = token.price * 0.0008;
  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];
  for (let i = 0; i < depth; i++) {
    asks.push({ price: token.price + tick * (depth - i), amount: series[i] * 3 });
    bids.push({ price: token.price - tick * (i + 1), amount: series[depth + i] * 3 });
  }
  return { asks, bids };
}
