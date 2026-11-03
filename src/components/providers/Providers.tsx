"use client";

import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";
import { GlobalStyle } from "@/styles/GlobalStyle";
import type { Token } from "@/data/tokens";
import { MarketProvider } from "./MarketProvider";
import { WatchlistProvider } from "./WatchlistProvider";
import WalletProvider from "./WalletProvider";

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
      <WalletProvider>
        <MarketProvider initialTokens={initialTokens}>
          <WatchlistProvider>{children}</WatchlistProvider>
        </MarketProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
