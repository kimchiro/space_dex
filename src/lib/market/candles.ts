/** 시각은 봉 시작 시각(초, UTC). */
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const INTERVALS = [
  { key: "1m", label: "1분", seconds: 60 },
  { key: "5m", label: "5분", seconds: 300 },
  { key: "15m", label: "15분", seconds: 900 },
  { key: "1h", label: "1시간", seconds: 3_600 },
  { key: "4h", label: "4시간", seconds: 14_400 },
  { key: "1d", label: "1일", seconds: 86_400 },
  { key: "1w", label: "1주", seconds: 604_800 },
] as const;

export type IntervalKey = (typeof INTERVALS)[number]["key"];

export const isIntervalKey = (value: string | null | undefined): value is IntervalKey =>
  INTERVALS.some((i) => i.key === value);

export const intervalSeconds = (key: IntervalKey) => INTERVALS.find((i) => i.key === key)!.seconds;

export const intervalLabel = (key: IntervalKey) => INTERVALS.find((i) => i.key === key)!.label;

/** 바 돋보기에 쓰는 하위 시간봉. 한 봉을 최대 100개 안팎의 하위 봉으로 쪼갠다. */
export function lowerIntervalFor(key: IntervalKey): IntervalKey | null {
  switch (key) {
    case "1m":
      return null;
    case "5m":
    case "15m":
    case "1h":
      return "1m";
    case "4h":
      return "5m";
    case "1d":
      return "15m";
    case "1w":
      return "1h";
  }
}

/** 데이터 출처. 차트·백테스트·리플레이가 같은 시장 데이터를 쓰도록 한 곳에서 정의한다. */
export const DATA_SOURCE = "Binance 현물";
export const marketPair = (symbol: string) => `${symbol.toUpperCase()}/USDT`;

export type CandlesResponse = { supported: false } | { supported: true; candles: Candle[]; error?: string };

export const MAX_CANDLES = 5_000;
