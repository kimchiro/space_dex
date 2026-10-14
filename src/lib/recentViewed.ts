"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "space-dex:recent-viewed";
const MAX_ITEMS = 20;
const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "LINK", "SUI", "AVAX", "TRX"];
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : DEFAULT_SYMBOLS;
  } catch {
    cache = DEFAULT_SYMBOLS;
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addRecentViewed(symbol: string) {
  const current = read();
  if (current[0] === symbol) return;
  write([symbol, ...current.filter((s) => s !== symbol)].slice(0, MAX_ITEMS));
}

export function removeRecentViewed(symbol: string) {
  write(read().filter((s) => s !== symbol));
}

export function useRecentViewed() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
