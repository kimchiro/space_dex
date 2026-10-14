"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type WatchlistContextValue = {
  watchlist: string[];
  isWatched: (symbol: string) => boolean;
  toggle: (symbol: string) => void;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<string[]>(["BTC", "ETH", "SOL"]);

  const toggle = useCallback((symbol: string) => {
    setWatchlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  }, []);

  const value = useMemo(
    () => ({ watchlist, isWatched: (s: string) => watchlist.includes(s), toggle }),
    [watchlist, toggle],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}
