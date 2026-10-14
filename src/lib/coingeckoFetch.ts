const API_BASE = "https://api.coingecko.com/api/v3";
const DEFAULT_COOLDOWN_MS = 60_000;

/** 개발 모드 HMR로 모듈이 다시 평가돼도 마지막 정상 응답과 쿨다운이 유지되도록 globalThis에 둔다. */
type CoinGeckoState = { cooldownUntil: number; snapshots: Map<string, unknown> };
const globalState = globalThis as typeof globalThis & { __coingecko?: CoinGeckoState };
const state = (globalState.__coingecko ??= { cooldownUntil: 0, snapshots: new Map() });

export function getSnapshot<T>(key: string) {
  return state.snapshots.get(key) as T | undefined;
}

export function setSnapshot<T>(key: string, value: T) {
  state.snapshots.set(key, value);
}

export class CoinGeckoError extends Error {
  constructor(public readonly status: number) {
    super(status === 429 ? "CoinGecko 호출 한도 초과(429)" : `CoinGecko 응답 오류(${status})`);
  }
}

/** 무료 API는 IP 단위로 분당 호출 수가 제한되므로, 429를 받으면 쿨다운 동안 호출을 멈춘다. */
export async function coingeckoFetch<T>(path: string): Promise<T> {
  if (Date.now() < state.cooldownUntil) throw new CoinGeckoError(429);

  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    state.cooldownUntil = Date.now() + (retryAfter > 0 ? retryAfter * 1000 : DEFAULT_COOLDOWN_MS);
  }
  if (!res.ok) throw new CoinGeckoError(res.status);
  return (await res.json()) as T;
}

export function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
