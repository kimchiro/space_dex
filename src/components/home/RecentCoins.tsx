"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { removeRecentViewed, useRecentViewed } from "@/lib/recentViewed";
import { useMarket } from "@/components/providers/MarketProvider";
import TokenIcon from "@/components/common/TokenIcon";

const SCROLL_STEP = 240;

export default function RecentCoins() {
  const recent = useRecentViewed();
  const { findToken } = useMarket();
  const coins = recent.map(findToken).filter((t): t is Token => Boolean(t));

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };

    // 세로 휠을 가로 스크롤로 바꾼다. 끝에 닿으면 페이지 스크롤로 넘긴다.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      const canScroll = e.deltaY > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 1;
      if (!canScroll) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
    };
  }, [coins.length]);

  const scrollBy = (dir: 1 | -1) =>
    scrollerRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });

  return (
    <Row>
      <Label>최근 조회</Label>
      <Viewport>
        {coins.length === 0 ? (
          <Empty>조회한 코인이 없어요. 코인을 눌러 상세 정보를 확인해 보세요.</Empty>
        ) : (
          <Scroller ref={scrollerRef}>
            <Track>
              {coins.map((coin) => (
                <Chip key={coin.symbol}>
                  <ChipLink href={`/trade/${coin.symbol}`}>
                    <TokenIcon symbol={coin.symbol} color={coin.color} image={coin.image} size={20} />
                    {coin.name}
                  </ChipLink>
                  <Remove
                    aria-label={`${coin.name} 최근 조회에서 삭제`}
                    onClick={() => removeRecentViewed(coin.symbol)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M7 7l10 10M17 7L7 17" />
                    </svg>
                  </Remove>
                </Chip>
              ))}
            </Track>
          </Scroller>
        )}

        {edges.left && (
          <Fade $side="left">
            <Arrow aria-label="이전 코인 보기" onClick={() => scrollBy(-1)}>
              ‹
            </Arrow>
          </Fade>
        )}
        {edges.right && (
          <Fade $side="right">
            <Arrow aria-label="다음 코인 보기" onClick={() => scrollBy(1)}>
              ›
            </Arrow>
          </Fade>
        )}
      </Viewport>
    </Row>
  );
}

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-bottom: 8px;
`;

const Label = styled.span`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Viewport = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`;

const Scroller = styled.div`
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Track = styled.div`
  display: flex;
  gap: 6px;
  width: max-content;
`;

const Chip = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 34px;
  padding: 0 4px 0 6px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.surface};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const ChipLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 2px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;
`;

const Remove = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${({ theme }) => theme.colors.textWeak};

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Fade = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  top: 0;
  bottom: 0;
  ${({ $side }) => $side}: 0;
  display: flex;
  align-items: center;
  justify-content: ${({ $side }) => ($side === "left" ? "flex-start" : "flex-end")};
  width: 64px;
  background: linear-gradient(
    to ${({ $side }) => ($side === "left" ? "right" : "left")},
    ${({ theme }) => theme.colors.bg} 40%,
    rgba(255, 255, 255, 0)
  );
  pointer-events: none;
`;

const Arrow = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: ${({ theme }) => theme.shadow.popover};
  font-size: 18px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textSub};
  pointer-events: auto;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Empty = styled.p`
  font-size: 13px;
  line-height: 34px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
