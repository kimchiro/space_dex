import type { Metadata } from "next";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "@/components/providers/Providers";
import AppShell from "@/components/layout/AppShell";
import { getMarketTokens } from "@/lib/coingecko";

export const metadata: Metadata = {
  title: "Space DEX",
  description: "토스증권을 오마주한 개인 코인 DEX 거래 플랫폼",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tokens = await getMarketTokens();

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <StyledComponentsRegistry>
          <Providers initialTokens={tokens}>
            <AppShell>{children}</AppShell>
          </Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
