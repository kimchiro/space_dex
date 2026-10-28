"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import TokenIcon from "@/components/common/TokenIcon";
import { useMarket } from "@/components/providers/MarketProvider";
import { searchTokens } from "@/lib/tokenSearch";
import { CloseIcon, LayoutIcon, SearchIcon } from "./icons";
import { formatQuote } from "./MarketPanel";

export const MAX_SPLIT = 6;

/** 분할 화면에 띄울 코인을 순서대로 최대 6개까지 고르는 메뉴. */
export default function SplitPicker({ initial, onApply, onCancel }: { initial: string[]; onApply: (symbols: string[]) => void; onCancel: () => void }) {
  const { tokens, findToken } = useMarket();
  const [selected, setSelected] = useState(() => [...new Set(initial)].slice(0, MAX_SPLIT));
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim();
    return q ? searchTokens(tokens, q) : [...tokens].sort((a, b) => b.volume24h - a.volume24h);
  }, [tokens, query]);

  const full = selected.length >= MAX_SPLIT;
  const toggle = (symbol: string) =>
    setSelected((s) => (s.includes(symbol) ? s.filter((x) => x !== symbol) : s.length >= MAX_SPLIT ? s : [...s, symbol]));

  return (
    <Panel>
      <Header>
        <strong>화면 분할 코인 선택</strong>
        <span>
          {selected.length}/{MAX_SPLIT}
        </span>
      </Header>

      <Selected aria-label="선택한 코인">
        {selected.map((s, i) => {
          const t = findToken(s);
          return (
            <Pill key={s}>
              <b>{i + 1}</b>
              {t && <TokenIcon symbol={t.symbol} color={t.color} image={t.image} size={16} />}
              {s}
              <button type="button" aria-label={`${s} 빼기`} onClick={() => toggle(s)}>
                <CloseIcon size={12} />
              </button>
            </Pill>
          );
        })}
        {selected.length === 0 && <Hint>아래 목록에서 코인을 골라 주세요.</Hint>}
      </Selected>

      <Search>
        <SearchIcon />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="코인 찾기 · 이름·초성" aria-label="분할할 코인 찾기" />
      </Search>

      <List role="listbox" aria-multiselectable="true" aria-label="코인 목록">
        {rows.map((t) => {
          const order = selected.indexOf(t.symbol);
          const on = order >= 0;
          return (
            <Row key={t.symbol} role="option" aria-selected={on} $on={on} $disabled={full && !on} onClick={() => (on || !full) && toggle(t.symbol)}>
              <Check $on={on}>{on ? order + 1 : ""}</Check>
              <TokenIcon symbol={t.symbol} color={t.color} image={t.image} size={20} />
              <Name>
                <strong>{t.symbol}</strong>
                <small>{t.name}</small>
              </Name>
              <Price>{formatQuote(t.price)}</Price>
              <Change $value={t.change24h}>
                {t.change24h > 0 ? "+" : ""}
                {t.change24h.toFixed(2)}%
              </Change>
            </Row>
          );
        })}
        {rows.length === 0 && <Hint>찾는 코인이 없어요.</Hint>}
      </List>

      <Footer>
        <small>{full ? "최대 6개까지 고를 수 있어요." : "고른 순서대로 화면에 배치돼요."}</small>
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <Apply type="button" disabled={selected.length === 0} onClick={() => onApply(selected)}>
          <LayoutIcon count={Math.max(1, selected.length)} size={14} />
          {selected.length <= 1 ? "1화면" : `${selected.length}분할`} 적용
        </Apply>
      </Footer>
    </Panel>
  );
}

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  width: min(360px, calc(100vw - 32px));
  max-height: min(520px, 70dvh);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  font-size: 14px;

  span {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Selected = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 40px;
  padding: 4px 12px 10px;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 4px 0 6px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.primaryWeak};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
  font-weight: 700;

  b {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 10px;
  }

  button {
    display: inline-flex;
    padding: 3px;
    border-radius: 50%;
    color: inherit;

    &:hover {
      background: ${({ theme }) => theme.colors.bg};
    }
  }
`;

const Hint = styled.p`
  padding: 6px 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Search = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  margin: 0 12px 6px;
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

const List = styled.ul`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px;

  ${Hint} {
    padding: 12px 6px;
  }
`;

const Row = styled.li<{ $on: boolean; $disabled: boolean }>`
  display: grid;
  grid-template-columns: 18px 20px minmax(0, 1fr) auto 62px;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 6px;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.45 : 1)};
  background: ${({ theme, $on }) => ($on ? theme.colors.primaryWeak : "transparent")};

  &:hover {
    background: ${({ theme, $on, $disabled }) => ($on ? theme.colors.primaryWeak : $disabled ? "transparent" : theme.colors.surface)};
  }
`;

const Check = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.textDisabled)};
  background: ${({ theme, $on }) => ($on ? theme.colors.primary : "transparent")};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
`;

const Name = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    font-size: 13px;
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

const Price = styled.span`
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.text};
`;

const Change = styled.span<{ $value: number }>`
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $value }) => ($value > 0 ? theme.colors.rise : $value < 0 ? theme.colors.fall : theme.colors.textSub)};
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  small {
    flex: 1;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  > button {
    height: 32px;
    padding: 0 12px;
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSub};

    &:hover {
      background: ${({ theme }) => theme.colors.surface};
    }
  }
`;

const Apply = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  && {
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
  }

  &&:disabled {
    background: ${({ theme }) => theme.colors.textDisabled};
    cursor: not-allowed;
  }
`;
