"use client";

import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";
import { GlobalStyle } from "@/styles/GlobalStyle";
import type { Token } from "@/data/tokens";
import { MarketProvider } from "./MarketProvider";
import { WatchlistProvider } from "./WatchlistProvider";

export default function Providers({
  initialTokens,
  children,
}: {
  initialTokens: Token[];
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <MarketProvider initialTokens={initialTokens}>
        <WatchlistProvider>{children}</WatchlistProvider>
      </MarketProvider>
    </ThemeProvider>
  );
}
