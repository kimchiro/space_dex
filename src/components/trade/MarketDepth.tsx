"use client";

import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { generateOrderBook, type Token } from "@/data/tokens";
import type { DepthLevel, MarketDepth as MarketDepthData } from "@/lib/binance";
import { formatAmount, formatPrice } from "@/lib/format";
import ChangeText from "@/components/common/ChangeText";

const LIVE_POLL_MS = 3_000;
const RETRY_POLL_MS = 15_000;

type DepthState =
  | { symbol: string; status: "live"; data: MarketDepthData }
  | { symbol: string; status: "unavailable" };

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function useMarketDepth(symbol: string) {
  const [state, setState] = useState<DepthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      let next = LIVE_POLL_MS;
      try {
        const res = await fetch(`/api/depth?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const data: MarketDepthData = await res.json();
          if (!cancelled) setState({ symbol, status: "live", data });
        } else {
          next = RETRY_POLL_MS;
          if (!cancelled) setState((prev) => (prev?.symbol === symbol && prev.status === "live" ? prev : { symbol, status: "unavailable" }));
        }
      } catch {
        next = RETRY_POLL_MS;
      }
      if (!cancelled) timer = setTimeout(load, next);
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [symbol]);

  return state?.symbol === symbol ? state : null;
}

function withCumulative(levels: DepthLevel[]) {
  let sum = 0;
  return levels.map((level) => {
    sum += level.amount;
    return { ...level, total: sum };
  });
}

export default function MarketDepth({ token }: { token: Token }) {
  const state = useMarketDepth(token.symbol);
  const live = state?.status === "live" ? state.data : null;

  const { asks, bids, maxTotal } = useMemo(() => {
    const source = live ?? (() => {
      const mock = generateOrderBook(token, 5);
      return { asks: [...mock.asks].reverse(), bids: mock.bids };
    })();
    const a = withCumulative(source.asks);
    const b = withCumulative(source.bids);
    return {
      asks: [...a].reverse(),
      bids: b,
      maxTotal: Math.max(a.at(-1)?.total ?? 0, b.at(-1)?.total ?? 0) || 1,
    };
  }, [live, token]);

  const trades = useMemo(() => {
    if (!live) return [];
    let sum = 0;
    return live.trades.map((t) => {
      sum += t.amount;
      return { ...t, total: sum };
    });
  }, [live]);

  const lastPrice = live?.trades[0]?.price ?? token.price;
  const unit = token.symbol;

  return (
    <Card>
      <Head>
        <Title>호가 · 체결</Title>
        <Source $live={Boolean(live)}>
          {live ? `실시간 · Binance ${live.pair} 기준` : state ? "예시 데이터" : "불러오는 중…"}
        </Source>
      </Head>

      <Panels>
        <Panel>
          <PanelTitle>호가</PanelTitle>
          <Columns $cols={3}>
            <span>가격(USD)</span>
            <span>수량({unit})</span>
            <span>누적({unit})</span>
          </Columns>
          <ul>
            {asks.map((level) => (
              <Row key={`a-${level.price}`} $cols={3}>
                <Bar $side="ask" style={{ width: `${(level.total / maxTotal) * 100}%` }} />
                <Price $side="sell">{formatPrice(level.price)}</Price>
                <span>{formatAmount(level.amount)}</span>
                <span>{formatAmount(level.total)}</span>
              </Row>
            ))}
          </ul>
          <Mid>
            <strong>{formatPrice(lastPrice)}</strong>
            <ChangeText value={token.change24h} size={12} />
          </Mid>
          <ul>
            {bids.map((level) => (
              <Row key={`b-${level.price}`} $cols={3}>
                <Bar $side="bid" style={{ width: `${(level.total / maxTotal) * 100}%` }} />
                <Price $side="buy">{formatPrice(level.price)}</Price>
                <span>{formatAmount(level.amount)}</span>
                <span>{formatAmount(level.total)}</span>
              </Row>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle>체결 내역</PanelTitle>
          <Columns $cols={4}>
            <span>가격(USD)</span>
            <span>수량({unit})</span>
            <span>누적({unit})</span>
            <span>거래시간</span>
          </Columns>
          {trades.length > 0 ? (
            <TradeList>
              {trades.map((t) => (
                <Row key={t.id} $cols={4}>
                  <Price $side={t.side}>{formatPrice(t.price)}</Price>
                  <span>{formatAmount(t.amount)}</span>
                  <span>{formatAmount(t.total)}</span>
                  <Time>{timeFormat.format(t.time)}</Time>
                </Row>
              ))}
            </TradeList>
          ) : (
            <Empty>{state ? "체결 데이터를 제공하지 않는 코인이에요." : "체결 내역을 불러오는 중…"}</Empty>
          )}
        </Panel>
      </Panels>
    </Card>
  );
}

const Card = styled.div`
  container-type: inline-size;
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
`;

const Title = styled.h3`
  font-size: 17px;
  font-weight: 700;
`;

const Source = styled.span<{ $live: boolean }>`
  font-size: 12px;
  color: ${({ theme, $live }) => ($live ? theme.colors.primary : theme.colors.textWeak)};
`;

const Panels = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;

  @container (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Panel = styled.div`
  min-width: 0;
`;

const PanelTitle = styled.h4`
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textSub};
`;

const grid = (cols: number) => (cols === 4 ? "1.2fr 1fr 1fr 0.9fr" : "1.2fr 1fr 1fr");

const Columns = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: ${({ $cols }) => grid($cols)};
  gap: 6px;
  padding: 0 6px 6px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};

  span:not(:first-child) {
    text-align: right;
  }
`;

const Row = styled.li<{ $cols: number }>`
  position: relative;
  display: grid;
  grid-template-columns: ${({ $cols }) => grid($cols)};
  gap: 6px;
  padding: 4px 6px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSub};

  > span {
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:not(:first-of-type) {
    text-align: right;
  }
`;

const Bar = styled.i<{ $side: "ask" | "bid" }>`
  position: absolute;
  top: 1px;
  right: 0;
  bottom: 1px;
  border-radius: 3px;
  background: ${({ theme, $side }) => ($side === "ask" ? theme.colors.fallWeak : theme.colors.riseWeak)};
`;

const Price = styled.span<{ $side: "buy" | "sell" }>`
  font-weight: 600;
  color: ${({ theme, $side }) => ($side === "buy" ? theme.colors.rise : theme.colors.fall)};
`;

const Time = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Mid = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0;
  padding: 6px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 14px;
`;

const TradeList = styled.ul`
  max-height: 296px;
  overflow-y: auto;
  scrollbar-width: thin;
`;

const Empty = styled.p`
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
