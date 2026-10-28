"use client";

import { usePathname } from "next/navigation";
import styled from "styled-components";
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
  const wide = pathname.startsWith("/lab");

  return (
    <>
      <Header />
      <NoticeBanner />
      <Body>
        <Main>{children}</Main>
        {!wide && <RightSidebar news={news} />}
      </Body>
    </>
  );
}

const Body = styled.div`
  display: flex;
  gap: 24px;
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: 24px;
`;

const Main = styled.main`
  container: main / inline-size;
  flex: 1;
  min-width: 0;
`;
