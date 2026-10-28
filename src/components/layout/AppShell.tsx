"use client";

import { usePathname } from "next/navigation";
import styled, { css } from "styled-components";
import type { CryptoNews } from "@/lib/news";
import Header from "./Header";
import RightSidebar from "./RightSidebar";
import NoticeBanner from "./NoticeBanner";

export default function AppShell({
  news,
  children,
}: {
  news: CryptoNews[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const fullscreen = pathname.startsWith("/lab");

  return (
    <Shell $fullscreen={fullscreen}>
      <Header />
      <NoticeBanner />
      <Body $fullscreen={fullscreen}>
        <Main>{children}</Main>
        {!fullscreen && <RightSidebar news={news} />}
      </Body>
    </Shell>
  );
}

const Shell = styled.div<{ $fullscreen: boolean }>`
  ${({ $fullscreen }) =>
    $fullscreen &&
    css`
      display: flex;
      flex-direction: column;
      height: 100dvh;
    `}
`;

const Body = styled.div<{ $fullscreen: boolean }>`
  display: flex;
  gap: 24px;
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: 24px;

  ${({ $fullscreen }) =>
    $fullscreen &&
    css`
      flex: 1;
      width: 100%;
      max-width: none;
      min-height: 0;
      padding: 0;
    `}
`;

const Main = styled.main`
  container: main / inline-size;
  flex: 1;
  min-width: 0;
`;
