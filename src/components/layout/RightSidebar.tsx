"use client";

import Link from "next/link";
import { useState } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { useMarket } from "@/components/providers/MarketProvider";
import { formatPrice } from "@/lib/format";
import { useRecentViewed } from "@/lib/recentViewed";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import TokenIcon from "@/components/common/TokenIcon";
import ChangeText from "@/components/common/ChangeText";
import type { CryptoNews } from "@/lib/news";
import SidebarFeed from "./SidebarFeed";

const tabs = [
  { key: "watch", label: "관심" },
  { key: "recent", label: "최근 본" },
  { key: "hot", label: "실시간" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const emptyMessages: Record<TabKey, string> = {
  watch: "관심 토큰이 없어요. 하트를 눌러 추가해 보세요.",
  recent: "최근 조회한 코인이 없어요.",
  hot: "",
};

export default function RightSidebar({ news }: { news: CryptoNews[] }) {
  const [tab, setTab] = useState<TabKey>("watch");
  const { watchlist } = useWatchlist();
  const recent = useRecentViewed();
  const { tokens, findToken } = useMarket();

  const list: Token[] =
    tab === "watch"
      ? tokens.filter((t) => watchlist.includes(t.symbol))
      : tab === "recent"
        ? recent.map(findToken).filter((t): t is Token => Boolean(t))
        : [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, 6);

  return (
    <Aside>
      <Tabs>
        {tabs.map((t) => (
          <Tab key={t.key} $active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </Tab>
        ))}
      </Tabs>

      {list.length === 0 ? (
        <Empty>{emptyMessages[tab]}</Empty>
      ) : (
        <List>
          {list.map((token) => (
            <li key={token.symbol}>
              <Row href={`/trade/${token.symbol}`}>
                <TokenIcon symbol={token.symbol} color={token.color} image={token.image} size={32} />
                <Info>
                  <Name>{token.name}</Name>
                  <Price>{formatPrice(token.price)}</Price>
                </Info>
                <ChangeText value={token.change24h} size={13} />
              </Row>
            </li>
          ))}
        </List>
      )}

      <WalletCard>
        <WalletTitle>지갑을 연결하고</WalletTitle>
        <WalletDesc>내 자산과 거래 내역을 한눈에 확인하세요</WalletDesc>
        <WalletButton>지갑 연결하기</WalletButton>
      </WalletCard>

      <SidebarFeed initialNews={news} />
    </Aside>
  );
}

const Aside = styled.aside`
  position: sticky;
  top: calc(${({ theme }) => theme.layout.headerHeight} + 24px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: ${({ theme }) => theme.layout.sidebarWidth};
  flex-shrink: 0;
  align-self: flex-start;
  max-height: calc(100vh - ${({ theme }) => theme.layout.headerHeight} - 48px);
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};

  @media (max-width: 1100px) {
    display: none;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 34px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : "transparent")};
  box-shadow: ${({ $active }) => ($active ? "0 1px 3px rgba(0,0,0,0.08)" : "none")};
  transition: all 0.15s;
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
`;

const Row = styled(Link)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: ${({ theme }) => theme.radius.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const Info = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const Name = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

const Price = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Empty = styled.p`
  padding: 32px 0;
  text-align: center;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const WalletCard = styled.div`
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.primaryWeak};
`;

const WalletTitle = styled.p`
  font-size: 16px;
  font-weight: 700;
`;

const WalletDesc = styled.p`
  margin-top: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSub};
`;

const WalletButton = styled.button`
  width: 100%;
  height: 40px;
  margin-top: 16px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
  font-weight: 600;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;
