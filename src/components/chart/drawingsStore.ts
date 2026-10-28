"use client";

import { useCallback } from "react";
import { createLocalStore } from "@/lib/localStore";
import type { Drawing } from "./drawingLayer";

const store = createLocalStore<Record<string, Drawing[]>>("space-dex:drawings", {});
const EMPTY: Drawing[] = [];

/** 종목별 작도. 시간봉이 바뀌어도 같은 가격·시각에 남는다. */
export function useDrawings(symbol: string) {
  const all = store.useValue();
  const setDrawings = useCallback(
    (drawings: Drawing[]) => store.write((prev) => ({ ...prev, [symbol]: drawings })),
    [symbol],
  );
  return [all[symbol] ?? EMPTY, setDrawings] as const;
}
