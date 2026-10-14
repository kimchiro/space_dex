"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { findToken, type Token } from "@/data/tokens";

const POLL_INTERVAL_MS = 60_000;

type MarketContextValue = {
  tokens: Token[];
  findToken: (symbol: string) => Token | undefined;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({
  initialTokens,
  children,
}: {
  initialTokens: Token[];
  children: React.ReactNode;
}) {
  const [tokens, setTokens] = useState(initialTokens);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/markets");
        if (res.ok) setTokens(await res.json());
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo(
    () => ({ tokens, findToken: (symbol: string) => findToken(tokens, symbol) }),
    [tokens],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within MarketProvider");
  return ctx;
}
