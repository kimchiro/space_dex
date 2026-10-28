"use client";

import { useMemo, useState, type Ref } from "react";
import styled from "styled-components";
import TokenIcon from "@/components/common/TokenIcon";
import { useMarket } from "@/components/providers/MarketProvider";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import type { Token } from "@/data/tokens";
import { formatCompact } from "@/lib/format";
import { useRecentViewed } from "@/lib/recentViewed";
import { searchTokens } from "@/lib/tokenSearch";
import { SearchIcon, StarIcon } from "./icons";

type ListTab = "all" | "watch" | "recent";
type SortKey = "change" | "volume";

const TABS: { key: ListTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "watch", label: "관심" },
  { key: "recent", label: "최근 본" },
];

export const formatQuote = (v: number) =>
  v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : v >= 1 ? v.toLocaleString("en-US", { maximumFractionDigits: 4 }) : v.toPrecision(4);

export default function MarketPanel({ active, onSelect, searchRef }: { active: string; onSelect: (symbol: string) => void; searchRef?: Ref<HTMLInputElement> }) {
  const { tokens } = useMarket();
  const { isWatched, toggle, watchlist } = useWatchlist();
  const recent = useRecentViewed();
  const [tab, setTab] = useState<ListTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "change", desc: true });

  const rows = useMemo(() => {
    const pick = (symbols: string[]) => symbols.map((s) => tokens.find((t) => t.symbol === s)).filter((t): t is Token => Boolean(t));
    const base = tab === "watch" ? pick(watchlist) : tab === "recent" ? pick(recent) : tokens;
    const q = query.trim();
    if (q) return searchTokens(base, q);
    const value = (t: Token) => (sort.key === "change" ? t.change24h : t.volume24h);
    return [...base].sort((a, b) => (sort.desc ? value(b) - value(a) : value(a) - value(b)));
  }, [tokens, tab, watchlist, recent, query, sort]);

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.desc ? "↓" : "↑") : "");

  return (
    <Wrapper>
      <Tabs>
        {TABS.map((t) => (
          <TabButton key={t.key} type="button" $active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
        <Count>{rows.length}개</Count>
      </Tabs>
      <Search>
        <SearchIcon />
        <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="종목 찾기 · 이름·초성" aria-label="종목 찾기" />
      </Search>
      <Head>
        <span>종목</span>
        <button type="button" onClick={() => sortBy("volume")}>
          현재가·거래대금 {arrow("volume")}
        </button>
        <button type="button" onClick={() => sortBy("change")}>
          변동% {arrow("change")}
        </button>
      </Head>
      <List>
        {rows.map((t) => (
          <Row key={t.symbol} $active={t.symbol === active} onClick={() => onSelect(t.symbol)}>
            <Star
              type="button"
              aria-label={isWatched(t.symbol) ? `${t.symbol} 관심 해제` : `${t.symbol} 관심 추가`}
              $on={isWatched(t.symbol)}
              onClick={(e) => {
                e.stopPropagation();
                toggle(t.symbol);
              }}
            >
              <StarIcon filled={isWatched(t.symbol)} />
            </Star>
            <Name>
              <TokenIcon symbol={t.symbol} color={t.color} image={t.image} size={20} />
              <span>
                <strong>{t.symbol}</strong>
                <small>{t.name}</small>
              </span>
            </Name>
            <Num>
              {formatQuote(t.price)}
              <small>{formatCompact(t.volume24h)}</small>
            </Num>
            <Change $value={t.change24h}>
              {t.change24h > 0 ? "+" : ""}
              {t.change24h.toFixed(2)}%
            </Change>
          </Row>
        ))}
        {rows.length === 0 && <Empty>{tab === "watch" ? "별표로 관심 종목을 추가해 보세요." : "찾는 종목이 없어요."}</Empty>}
      </List>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const Tabs = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 10px 12px 6px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
`;

const Count = styled.span`
  margin-left: auto;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Search = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  margin: 0 12px 8px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.text};
    outline: none;
  }
`;

const grid = "18px minmax(0, 1fr) 96px 62px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${grid};
  gap: 6px;
  padding: 4px 12px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};

  span {
    grid-column: 1 / 3;
  }

  button {
    font-size: 11px;
    color: inherit;
    text-align: right;
  }
`;

const List = styled.ul`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

const Row = styled.li<{ $active: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: ${grid};
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : "transparent")};

  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 3px;
    background: ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
  }

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.bgSub)};
  }
`;

const Star = styled.button<{ $on: boolean }>`
  display: flex;
  color: ${({ theme, $on }) => ($on ? "#ffb800" : theme.colors.textDisabled)};
`;

const Name = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  strong {
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  }

  small {
    overflow: hidden;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.textWeak};
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Num = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.text};

  small {
    font-size: 10px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Change = styled.span<{ $value: number }>`
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: ${({ theme, $value }) => ($value > 0 ? theme.colors.rise : $value < 0 ? theme.colors.fall : theme.colors.textWeak)};
`;

const Empty = styled.li`
  padding: 32px 12px;
  font-size: 13px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
`;
