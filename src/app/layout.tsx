import type { Metadata } from "next";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "@/components/providers/Providers";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Space DEX",
  description: "토스증권을 오마주한 개인 코인 DEX 거래 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
