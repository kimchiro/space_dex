"use client";

import { useEffect, useState } from "react";
import type { Candle, CandlesResponse, IntervalKey } from "./candles";

const LIVE_POLL_MS = 5_000;

export type CandlesQuery = { symbol: string; interval: IntervalKey; limit?: number; start?: number; end?: number };

export async function fetchCandles({ symbol, interval, limit, start, end }: CandlesQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ symbol, interval });
  if (limit !== undefined) params.set("limit", String(limit));
  if (start !== undefined) params.set("start", String(start));
  if (end !== undefined) params.set("end", String(end));
  const res = await fetch(`/api/klines?${params}`, { signal });
  if (!res.ok) throw new Error(`캔들 요청 실패 (${res.status})`);
  return (await res.json()) as CandlesResponse;
}

/** 같은 시각의 봉은 새 값으로 바꾸고, 새 봉은 뒤에 붙인다. */
export function mergeCandles(base: Candle[], updates: Candle[]) {
  if (updates.length === 0) return base;
  const next = base.slice();
  for (const candle of updates) {
    const last = next[next.length - 1];
    if (!last || candle.time > last.time) next.push(candle);
    else {
      const index = next.findIndex((c) => c.time === candle.time);
      if (index >= 0) next[index] = candle;
    }
  }
  return next;
}

export type CandlesState = {
  status: "loading" | "ready" | "unsupported" | "error";
  candles: Candle[];
  error?: string;
};

type Loaded = CandlesState & { key: string };

const LOADING: CandlesState = { status: "loading", candles: [] };

export function useCandles(symbol: string, interval: IntervalKey, { limit = 500, live = false } = {}): CandlesState {
  const key = `${symbol}:${interval}:${limit}`;
  const [state, setState] = useState<Loaded | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await fetchCandles({ symbol, interval, limit: 2 }, controller.signal);
        if (result.supported && result.candles.length) {
          setState((prev) => (prev?.key === key ? { ...prev, candles: mergeCandles(prev.candles, result.candles) } : prev));
        }
      } catch {}
      if (!controller.signal.aborted) timer = setTimeout(poll, LIVE_POLL_MS);
    };

    fetchCandles({ symbol, interval, limit }, controller.signal)
      .then((result) => {
        if (!result.supported) return setState({ key, status: "unsupported", candles: [] });
        if (result.error || result.candles.length === 0) {
          return setState({ key, status: "error", candles: [], error: result.error ?? "캔들 데이터가 없어요." });
        }
        setState({ key, status: "ready", candles: result.candles });
        if (live) timer = setTimeout(poll, LIVE_POLL_MS);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ key, status: "error", candles: [], error: error instanceof Error ? error.message : String(error) });
        }
      });

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, symbol, interval, limit, live]);

  return state?.key === key ? state : LOADING;
}
