"use client";

import styled from "styled-components";
import { generateOrderBook, type Token } from "@/data/tokens";
import { formatAmount, formatPrice } from "@/lib/format";
import ChangeText from "@/components/common/ChangeText";

export default function OrderBook({ token }: { token: Token }) {
  const { asks, bids } = generateOrderBook(token);
  const maxAmount = Math.max(...asks.map((a) => a.amount), ...bids.map((b) => b.amount));

  return (
    <Card>
      <Title>호가</Title>
      <Head>
        <span>가격(USD)</span>
        <span>수량({token.symbol})</span>
      </Head>
      <Levels>
        {asks.map((level) => (
          <Level key={`a-${level.price}`}>
            <Bar $side="ask" style={{ width: `${(level.amount / maxAmount) * 100}%` }} />
            <AskPrice>{formatPrice(level.price)}</AskPrice>
            <Amount>{formatAmount(level.amount)}</Amount>
          </Level>
        ))}
      </Levels>
      <Mid>
        <strong>{formatPrice(token.price)}</strong>
        <ChangeText value={token.change24h} size={13} />
      </Mid>
      <Levels>
        {bids.map((level) => (
          <Level key={`b-${level.price}`}>
            <Bar $side="bid" style={{ width: `${(level.amount / maxAmount) * 100}%` }} />
            <BidPrice>{formatPrice(level.price)}</BidPrice>
            <Amount>{formatAmount(level.amount)}</Amount>
          </Level>
        ))}
      </Levels>
    </Card>
  );
}

const Card = styled.div`
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h3`
  margin-bottom: 12px;
  font-size: 17px;
  font-weight: 700;
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0 8px 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Levels = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Level = styled.li`
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 5px 8px;
  font-size: 13px;
`;

const Bar = styled.span<{ $side: "ask" | "bid" }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 4px;
  background: ${({ theme, $side }) => ($side === "ask" ? theme.colors.fallWeak : theme.colors.riseWeak)};
`;

const AskPrice = styled.span`
  position: relative;
  color: ${({ theme }) => theme.colors.fall};
`;

const BidPrice = styled.span`
  position: relative;
  color: ${({ theme }) => theme.colors.rise};
`;

const Amount = styled.span`
  position: relative;
  color: ${({ theme }) => theme.colors.textSub};
`;

const Mid = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
  padding: 10px 8px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 16px;
`;
