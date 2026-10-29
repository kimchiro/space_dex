"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styled from "styled-components";
import { generateSeries, tokenSubtitle, type Token } from "@/data/tokens";
import { formatCompact, formatPrice } from "@/lib/format";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import { useMarket } from "@/components/providers/MarketProvider";
import TokenIcon from "@/components/common/TokenIcon";
import ChangeText from "@/components/common/ChangeText";
import Sparkline from "@/components/common/Sparkline";
import RecentCoins from "./RecentCoins";

const sortTabs = [
  { key: "volume", label: "거래대금", sort: (a: Token, b: Token) => b.volume24h - a.volume24h },
  { key: "marketCap", label: "시가총액", sort: (a: Token, b: Token) => b.marketCap - a.marketCap },
  { key: "rise", label: "급상승", sort: (a: Token, b: Token) => b.change24h - a.change24h },
  { key: "fall", label: "급하락", sort: (a: Token, b: Token) => a.change24h - b.change24h },
] as const;

const periods = ["실시간", "1일", "1주일", "1개월"];

type SortKey = (typeof sortTabs)[number]["key"];

export default function TokenRanking() {
  const router = useRouter();
  const { isWatched, toggle } = useWatchlist();
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [period, setPeriod] = useState(periods[0]);
  const { tokens } = useMarket();

  const rows = useMemo(() => {
    const sorter = sortTabs.find((t) => t.key === sortKey)!.sort;
    return [...tokens].sort(sorter);
  }, [sortKey, tokens]);

  return (
    <Section>
      <TitleRow>
        <Title>실시간 차트</Title>
        <Periods>
          {periods.map((p) => (
            <PeriodChip key={p} $active={p === period} onClick={() => setPeriod(p)}>
              {p}
            </PeriodChip>
          ))}
        </Periods>
      </TitleRow>

      <SortTabs>
        {sortTabs.map((t) => (
          <SortTab key={t.key} $active={t.key === sortKey} onClick={() => setSortKey(t.key)}>
            {t.label}
          </SortTab>
        ))}
      </SortTabs>

      <RecentCoins />

      <TableScroll>
        <Table>
          <thead>
            <tr>
              <Th $align="left">순위 · 토큰</Th>
              <Th>현재가</Th>
              <Th $hideBelow={STACK_CHANGE}>등락률</Th>
              <Th $hideBelow={HIDE_AMOUNTS}>24h 거래대금</Th>
              <Th $hideBelow={HIDE_AMOUNTS}>시가총액</Th>
              <Th $hideBelow={HIDE_SPARKLINE}>7일 차트</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((token, i) => (
              <Tr key={token.symbol} onClick={() => router.push(`/trade/${token.symbol}`)}>
                <Td $align="left">
                  <TokenCell>
                    <Rank>{i + 1}</Rank>
                    <TokenIcon symbol={token.symbol} color={token.color} image={token.image} />
                    <div>
                      <TokenName>{token.name}</TokenName>
                      <TokenSub>{tokenSubtitle(token)}</TokenSub>
                    </div>
                  </TokenCell>
                </Td>
                <Td>
                  <Strong>{formatPrice(token.price)}</Strong>
                  <StackedChange>
                    <ChangeText value={token.change24h} size={13} />
                  </StackedChange>
                </Td>
                <Td $hideBelow={STACK_CHANGE}>
                  <ChangeText value={token.change24h} />
                </Td>
                <Td $hideBelow={HIDE_AMOUNTS}>{formatCompact(token.volume24h)}</Td>
                <Td $hideBelow={HIDE_AMOUNTS}>{formatCompact(token.marketCap)}</Td>
                <Td $hideBelow={HIDE_SPARKLINE}>
                  <SparkWrap>
                    <Sparkline data={sparkFor(token)} />
                  </SparkWrap>
                </Td>
                <Td>
                  <Heart
                    aria-label={isWatched(token.symbol) ? "관심 해제" : "관심 추가"}
                    $active={isWatched(token.symbol)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(token.symbol);
                    }}
                  >
                    ♥
                  </Heart>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </Section>
  );
}

function sparkFor(token: Token) {
  if (token.sparkline) return token.sparkline;
  const series = generateSeries(token.symbol, 30, token.price, 0.012);
  const isUp = series[series.length - 1] >= series[0];
  if (isUp !== token.change24h >= 0) series.reverse();
  return series;
}

// 표가 좁아지면 덜 중요한 열부터 숨긴다. 기준은 본문(main) 폭이다.
const HIDE_AMOUNTS = 720;
const HIDE_SPARKLINE = 480;
// 이 폭부터는 등락률을 별도 열 대신 현재가 아래에 붙인다.
const STACK_CHANGE = 480;

const Section = styled.section``;

const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

const TableScroll = styled.div`
  overflow-x: auto;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
`;

const Periods = styled.div`
  display: flex;
  gap: 6px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
`;

const SortTabs = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
`;

const SortTab = styled.button<{ $active: boolean }>`
  padding: 8px 0;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textDisabled)};
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const PeriodChip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.primary)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.primaryWeak)};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryHover : "#d6e8ff")};
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

type CellProps = { $align?: "left" | "right"; $hideBelow?: number };

const hideBelow = ({ $hideBelow }: CellProps) =>
  $hideBelow ? `@container main (max-width: ${$hideBelow}px) { display: none; }` : "";

const Th = styled.th<CellProps>`
  padding: 12px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  text-align: ${({ $align }) => $align ?? "right"};
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  ${hideBelow}

  @container main (max-width: 480px) {
    padding: 10px 4px;
  }
`;

const Tr = styled.tr`
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const Td = styled.td<CellProps>`
  padding: 12px 8px;
  text-align: ${({ $align }) => $align ?? "right"};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;
  ${hideBelow}

  @container main (max-width: 480px) {
    padding: 10px 4px;
    font-size: 14px;
  }
`;

const TokenCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @container main (max-width: 480px) {
    gap: 8px;

    > img,
    > span[aria-hidden] {
      width: 32px;
      height: 32px;
    }
  }

  > div {
    min-width: 0;
    max-width: 160px;

    @container main (max-width: 480px) {
      max-width: 120px;
    }
  }
`;

const Rank = styled.span`
  width: 20px;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-align: center;
`;

const TokenName = styled.p`
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  text-overflow: ellipsis;
`;

const TokenSub = styled.p`
  overflow: hidden;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-overflow: ellipsis;
`;

const Strong = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const StackedChange = styled.div`
  display: none;
  margin-top: 2px;

  @container main (max-width: ${STACK_CHANGE}px) {
    display: block;
  }
`;

const SparkWrap = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const Heart = styled.button<{ $active: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  color: ${({ theme, $active }) => ($active ? theme.colors.rise : theme.colors.textDisabled)};
  transition: transform 0.15s, color 0.15s;

  &:hover {
    transform: scale(1.15);
  }
`;
