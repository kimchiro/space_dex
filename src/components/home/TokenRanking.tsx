"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styled from "styled-components";
import { generateSeries, tokens, type Token } from "@/data/tokens";
import { formatCompact, formatPrice } from "@/lib/format";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import TokenIcon from "@/components/common/TokenIcon";
import ChangeText from "@/components/common/ChangeText";
import Sparkline from "@/components/common/Sparkline";

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
  const [chain, setChain] = useState("전체");

  const chainFilters = ["전체", ...new Set(tokens.map((t) => t.chain))];

  const rows = useMemo(() => {
    const sorter = sortTabs.find((t) => t.key === sortKey)!.sort;
    return tokens.filter((t) => chain === "전체" || t.chain === chain).sort(sorter);
  }, [sortKey, chain]);

  return (
    <Section>
      <TitleRow>
        <Title>실시간 차트</Title>
        <Periods>
          {periods.map((p) => (
            <Chip key={p} $active={p === period} onClick={() => setPeriod(p)}>
              {p}
            </Chip>
          ))}
        </Periods>
      </TitleRow>

      <FilterRow>
        <SortTabs>
          {sortTabs.map((t) => (
            <SortTab key={t.key} $active={t.key === sortKey} onClick={() => setSortKey(t.key)}>
              {t.label}
            </SortTab>
          ))}
        </SortTabs>
        <ChainFilters>
          {chainFilters.map((c) => (
            <Chip key={c} $active={c === chain} onClick={() => setChain(c)}>
              {c}
            </Chip>
          ))}
        </ChainFilters>
      </FilterRow>

      <Table>
        <thead>
          <tr>
            <Th $align="left">순위 · 토큰</Th>
            <Th>현재가</Th>
            <Th>등락률</Th>
            <Th>24h 거래대금</Th>
            <Th>시가총액</Th>
            <Th>차트</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((token, i) => (
            <Tr key={token.symbol} onClick={() => router.push(`/trade/${token.symbol}`)}>
              <Td $align="left">
                <TokenCell>
                  <Rank>{i + 1}</Rank>
                  <TokenIcon symbol={token.symbol} color={token.color} />
                  <div>
                    <TokenName>{token.name}</TokenName>
                    <TokenSub>
                      {token.symbol} · {token.chain}
                    </TokenSub>
                  </div>
                </TokenCell>
              </Td>
              <Td>
                <Strong>{formatPrice(token.price)}</Strong>
              </Td>
              <Td>
                <ChangeText value={token.change24h} />
              </Td>
              <Td>{formatCompact(token.volume24h)}</Td>
              <Td>{formatCompact(token.marketCap)}</Td>
              <Td>
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
    </Section>
  );
}

function sparkFor(token: Token) {
  const series = generateSeries(token.symbol, 30, token.price, 0.012);
  const isUp = series[series.length - 1] >= series[0];
  if (isUp !== token.change24h >= 0) series.reverse();
  return series;
}

const Section = styled.section``;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
`;

const Periods = styled.div`
  display: flex;
  gap: 6px;
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
`;

const SortTabs = styled.div`
  display: flex;
  gap: 16px;
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

const ChainFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.button<{ $active: boolean }>`
  height: 32px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.surface)};
  transition: all 0.15s;

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.surfaceHover)};
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th<{ $align?: "left" | "right" }>`
  padding: 12px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  text-align: ${({ $align }) => $align ?? "right"};
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Tr = styled.tr`
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const Td = styled.td<{ $align?: "left" | "right" }>`
  padding: 12px 8px;
  text-align: ${({ $align }) => $align ?? "right"};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;
`;

const TokenCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Rank = styled.span`
  width: 20px;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-align: center;
`;

const TokenName = styled.p`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const TokenSub = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Strong = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
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
