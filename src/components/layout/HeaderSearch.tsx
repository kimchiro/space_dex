"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import styled from "styled-components";
import ChangeText from "@/components/common/ChangeText";
import TokenIcon from "@/components/common/TokenIcon";
import { useMarket } from "@/components/providers/MarketProvider";
import { findToken, type Token } from "@/data/tokens";
import { formatPrice } from "@/lib/format";
import { useRecentViewed } from "@/lib/recentViewed";
import { searchTokens } from "@/lib/tokenSearch";

const MAX_RESULTS = 8;

/** onClose: 좁은 화면에서 펼친 검색창처럼, 이동하거나 Esc를 누르면 닫혀야 할 때 넘긴다. */
export default function HeaderSearch({ autoFocus = false, onClose }: { autoFocus?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { tokens } = useMarket();
  const recentSymbols = useRecentViewed();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const results = useMemo(() => {
    if (trimmed) return searchTokens(tokens, trimmed, MAX_RESULTS);
    return recentSymbols
      .map((symbol) => findToken(tokens, symbol))
      .filter((t): t is Token => Boolean(t))
      .slice(0, MAX_RESULTS);
  }, [tokens, trimmed, recentSymbols]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goTo = (token: Token) => {
    router.push(`/trade/${token.symbol}`);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onClose?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        break;
      case "Enter": {
        const target = results[activeIndex] ?? results[0];
        if (target) goTo(target);
        break;
      }
      case "Escape":
        setOpen(false);
        inputRef.current?.blur();
        onClose?.();
        break;
    }
  };

  const showPanel = open && (results.length > 0 || trimmed.length > 0);
  const activeId = results[activeIndex] ? `${listId}-${results[activeIndex].symbol}` : undefined;

  return (
    <Wrapper>
      <Field $focused={open}>
        <SearchIcon viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </SearchIcon>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          placeholder="코인 이름, 심볼 검색"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel ? activeId : undefined}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <ClearButton
            type="button"
            aria-label="검색어 지우기"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
            }}
          >
            ×
          </ClearButton>
        ) : (
          <Kbd>⌘K</Kbd>
        )}
      </Field>

      {showPanel && (
        <Panel onMouseDown={(e) => e.preventDefault()}>
          <PanelTitle>{trimmed ? "코인 검색 결과" : "최근 조회한 코인"}</PanelTitle>
          {results.length === 0 ? (
            <Empty>
              <strong>&lsquo;{trimmed}&rsquo;</strong>에 해당하는 코인이 없어요.
            </Empty>
          ) : (
            <ul id={listId} role="listbox">
              {results.map((token, i) => (
                <li key={token.symbol}>
                  <Option
                    id={`${listId}-${token.symbol}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    $active={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => goTo(token)}
                  >
                    <TokenIcon symbol={token.symbol} color={token.color} image={token.image} size={32} />
                    <Names>
                      <strong>{token.name}</strong>
                      <span>{token.symbol}</span>
                    </Names>
                    <Quote>
                      <span>{formatPrice(token.price)}</span>
                      <ChangeText value={token.change24h} size={13} />
                    </Quote>
                  </Option>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Field = styled.label<{ $focused: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $focused }) => ($focused ? theme.colors.bg : theme.colors.surface)};
  box-shadow: ${({ theme, $focused }) => ($focused ? `inset 0 0 0 1.5px ${theme.colors.primary}` : "none")};
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: text;
  transition: background 0.15s, box-shadow 0.15s;

  input {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.text};

    &::placeholder {
      color: ${({ theme }) => theme.colors.textWeak};
    }
  }
`;

const SearchIcon = styled.svg`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
`;

const Kbd = styled.span`
  padding: 2px 6px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bg};
  font-size: 12px;
`;

const ClearButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.textDisabled};
  color: #fff;
  font-size: 14px;
  line-height: 1;
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 440px;
  overflow-y: auto;
  padding: 8px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: ${({ theme }) => theme.shadow.popover};
`;

const PanelTitle = styled.p`
  padding: 8px 10px 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Empty = styled.p`
  padding: 20px 10px 24px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSub};
  text-align: center;

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
  text-align: left;
`;

const Names = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;

  strong {
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Quote = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
`;
