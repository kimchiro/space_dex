"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { tokenSubtitle, type Token } from "@/data/tokens";
import { formatCompact, formatPrice } from "@/lib/format";
import { addRecentViewed } from "@/lib/recentViewed";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import { useMarket } from "@/components/providers/MarketProvider";
import TokenIcon from "@/components/common/TokenIcon";
import ChangeText from "@/components/common/ChangeText";
import PriceChart from "./PriceChart";
import MarketDepth from "./MarketDepth";
import SwapPanel from "./SwapPanel";
import CoinInfo from "./CoinInfo";
import NewsList from "./NewsList";
import DetailTabs, { type DetailTabKey } from "./DetailTabs";

export default function TradeView({ token: initialToken }: { token: Token }) {
  const [tab, setTab] = useState<DetailTabKey>("chart");
  const { findToken } = useMarket();
  const token = findToken(initialToken.symbol) ?? initialToken;
  const { isWatched, toggle } = useWatchlist();
  const watched = isWatched(token.symbol);

  useEffect(() => {
    addRecentViewed(token.symbol);
  }, [token.symbol]);

  return (
    <>
      <TokenHeader>
        <TokenIcon symbol={token.symbol} color={token.color} image={token.image} size={44} />
        <div>
          <NameRow>
            <Name>{token.name}</Name>
            <Symbol>{tokenSubtitle(token)}</Symbol>
          </NameRow>
          <PriceRow>
            <Price>{formatPrice(token.price)}</Price>
            <ChangeText value={token.change24h} size={16} />
            <Muted>24시간</Muted>
          </PriceRow>
        </div>
        <WatchButton $active={watched} onClick={() => toggle(token.symbol)}>
          {watched ? "♥ 관심 토큰" : "♡ 관심 추가"}
        </WatchButton>
      </TokenHeader>

      <DetailTabs value={tab} onChange={setTab} />

      <Grid>
        <ContentColumn>
          {tab === "chart" && (
            <ChartTab>
              <Stats>
                <Stat>
                  <dt>24h 거래대금</dt>
                  <dd>{formatCompact(token.volume24h)}</dd>
                </Stat>
                <Stat>
                  <dt>시가총액</dt>
                  <dd>{formatCompact(token.marketCap)}</dd>
                </Stat>
                <Stat>
                  <dt>24h 최고</dt>
                  <dd>{formatPrice(token.high24h ?? token.price * 1.031)}</dd>
                </Stat>
                <Stat>
                  <dt>24h 최저</dt>
                  <dd>{formatPrice(token.low24h ?? token.price * 0.972)}</dd>
                </Stat>
              </Stats>
              <PriceChart token={token} />
              <MarketDepth token={token} />
            </ChartTab>
          )}
          {tab === "info" && <CoinInfo token={token} />}
          {tab === "news" && <NewsList token={token} />}
        </ContentColumn>
        <OrderColumn>
          <SwapPanel token={token} />
        </OrderColumn>
      </Grid>
    </>
  );
}

const TokenHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const Name = styled.h1`
  font-size: 18px;
  font-weight: 700;
`;

const Symbol = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
`;

const Price = styled.span`
  font-size: 28px;
  font-weight: 700;
`;

const Muted = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const WatchButton = styled.button<{ $active: boolean }>`
  margin-left: auto;
  height: 38px;
  padding: 0 16px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? theme.colors.rise : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.riseWeak : theme.colors.surface)};
`;

const Stats = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  padding: 16px 20px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSub};
`;

const Stat = styled.div`
  dt {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  dd {
    margin-top: 4px;
    font-size: 15px;
    font-weight: 600;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;

  @container main (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const ContentColumn = styled.div`
  min-width: 0;
`;

const ChartTab = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const OrderColumn = styled.div`
  position: sticky;
  top: calc(${({ theme }) => theme.layout.headerHeight} + 24px);

  @container main (max-width: 800px) {
    position: static;
  }
`;
