"use client";

import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";
import { GlobalStyle } from "@/styles/GlobalStyle";
import { WatchlistProvider } from "./WatchlistProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <WatchlistProvider>{children}</WatchlistProvider>
    </ThemeProvider>
  );
}
