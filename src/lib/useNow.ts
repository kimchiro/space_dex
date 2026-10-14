"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

/** 현재 시각(ms). 서버 렌더링과 하이드레이션 중에는 0을 반환한다. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
