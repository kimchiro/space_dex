"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import { createLocalStore } from "@/lib/localStore";

export const labTourStore = createLocalStore("spacedex:lab-tour-seen", false);

type Step = { target: string; title: string; body: string };

/** 각 단계의 target은 LabView에서 강조할 요소에 붙인 data-tour 값이다. */
const STEPS: Step[] = [
  { target: "symbol", title: "종목 바꾸기", body: "여기를 누르면 오른쪽 종목 패널에서 코인을 찾을 수 있어요. 이름·심볼은 물론 초성으로도 검색돼요." },
  { target: "interval", title: "시간봉 고르기", body: "1분부터 1주까지 캔들 간격을 바꿔 보세요. 지금 선택된 차트에만 적용돼요." },
  { target: "chart", title: "실시간 차트", body: "Binance 시세가 실시간으로 반영돼요. 화면을 나눴다면 차트를 눌러 고른 뒤 툴바로 설정을 바꿀 수 있어요." },
  { target: "indicators", title: "보조지표와 내 전략", body: "이동평균선·볼린저 밴드·RSI를 켜고 끄거나, Pine으로 만든 내 지표·전략을 차트에 올려 보세요." },
  { target: "layout", title: "화면 분할과 레이아웃 저장", body: "최대 6개 종목을 한 화면에서 비교할 수 있어요. 레이아웃을 저장하면 다음에 와도 그대로 열려요." },
  { target: "draw", title: "작도 도구", body: "추세선·수평선·피보나치 되돌림을 그려 보세요. 작도는 종목별로 저장되고 ⌘Z로 되돌릴 수 있어요." },
  { target: "share", title: "저장·공유·전체 화면", body: "차트를 이미지로 저장하거나 카카오톡·텔레그램·문자·이메일로 공유하고, 전체 화면으로 크게 볼 수 있어요." },
  { target: "panels", title: "종목·호가·뉴스 패널", body: "종목 목록, 실시간 호가, 코인 뉴스를 오른쪽 패널에서 확인해요. 패널 가장자리 손잡이로 접고 펼 수 있어요." },
  { target: "advanced", title: "고급 도구", body: "Pine 편집기로 지표·전략을 만들고, 전략 테스터로 백테스트하고, 리플레이로 지난 차트에서 매매를 연습해 보세요." },
  { target: "guide", title: "가이드 다시 보기", body: "이 안내는 언제든 여기서 다시 볼 수 있어요. 이제 자유롭게 둘러보세요!" },
];

const PAD = 6;
const GAP = 14;
const EDGE = 12;

type Box = { top: number; left: number; width: number; height: number };
type Layout = { target: Box | null; card: { width: number; height: number }; vw: number; vh: number };

function sameLayout(a: Layout | null, b: Layout) {
  if (!a) return false;
  const t = a.target;
  const u = b.target;
  const sameTarget = t === u || (!!t && !!u && t.top === u.top && t.left === u.left && t.width === u.width && t.height === u.height);
  return sameTarget && a.card.width === b.card.width && a.card.height === b.card.height && a.vw === b.vw && a.vh === b.vh;
}

/** 강조 영역의 위·아래·오른쪽·왼쪽 순으로 말풍선이 들어갈 자리를 찾고, 없으면 강조 영역 안쪽 아래에 겹쳐 띄운다. */
function placeCard({ target, card, vw, vh }: Layout) {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - card.width - EDGE));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - card.height - EDGE));
  if (!target) return { top: (vh - card.height) / 2, left: (vw - card.width) / 2 };

  const centerX = clampX(target.left + target.width / 2 - card.width / 2);
  const centerY = clampY(target.top + target.height / 2 - card.height / 2);
  const bottom = target.top + target.height + PAD + GAP;
  const top = target.top - PAD - GAP - card.height;
  const right = target.left + target.width + PAD + GAP;
  const left = target.left - PAD - GAP - card.width;

  if (bottom + card.height <= vh - EDGE) return { top: bottom, left: centerX };
  if (top >= EDGE) return { top, left: centerX };
  if (right + card.width <= vw - EDGE) return { top: centerY, left: right };
  if (left >= EDGE) return { top: centerY, left };
  return { top: clampY(target.top + target.height - card.height - GAP), left: centerX };
}

export default function LabTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    labTourStore.write(true);
    onClose();
  };
  const go = (next: number) => setIndex(Math.max(0, Math.min(next, STEPS.length - 1)));
  const advance = () => (last ? finish() : go(index + 1));

  // 패널이 열고 닫히거나 창 크기가 바뀌어도 강조 영역이 따라가도록 매 프레임 위치를 다시 잰다.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });

    let frame = requestAnimationFrame(function measure() {
      const r = el?.getBoundingClientRect();
      const card = cardRef.current;
      const next: Layout = {
        target: r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
        card: { width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 },
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
      frame = requestAnimationFrame(measure);
    });
    return () => cancelAnimationFrame(frame);
  }, [step.target]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // 위치를 잡기 전에는 말풍선이 숨겨져 있어 포커스를 받을 수 없으므로, 보이게 된 뒤에 옮긴다.
  const ready = layout !== null;
  useEffect(() => {
    if (ready) nextRef.current?.focus();
  }, [ready, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Tab") {
        const buttons = [...(cardRef.current?.querySelectorAll<HTMLElement>("button") ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLElement);
        buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const position = layout ? placeCard(layout) : null;
  const spot = layout?.target;

  return createPortal(
    <>
      <Blocker aria-hidden />
      <Spotlight aria-hidden $empty={!spot} style={spot ? { top: spot.top - PAD, left: spot.left - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 } : undefined} />
      <Card ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="lab-tour-title" aria-describedby="lab-tour-body" $ready={!!position} style={position ?? undefined}>
        <Count>
          {index + 1} / {STEPS.length}
        </Count>
        <h2 id="lab-tour-title">{step.title}</h2>
        <p id="lab-tour-body">{step.body}</p>
        <Footer>
          <Dots aria-hidden>
            {STEPS.map((s, i) => (
              <i key={s.target} data-active={i === index || undefined} />
            ))}
          </Dots>
          {!last && (
            <Ghost type="button" onClick={finish}>
              건너뛰기
            </Ghost>
          )}
          {index > 0 && (
            <Secondary type="button" onClick={() => go(index - 1)}>
              이전
            </Secondary>
          )}
          <Primary ref={nextRef} type="button" onClick={advance}>
            {last ? "시작하기" : "다음"}
          </Primary>
        </Footer>
      </Card>
    </>,
    document.fullscreenElement ?? document.body,
  );
}

const motion = css`
  @media (prefers-reduced-motion: no-preference) {
    transition:
      top 240ms ease,
      left 240ms ease,
      width 240ms ease,
      height 240ms ease;
  }
`;

const Blocker = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
`;

const Spotlight = styled.div<{ $empty: boolean }>`
  position: fixed;
  z-index: 2001;
  border-radius: 10px;
  pointer-events: none;
  box-shadow:
    0 0 0 2px ${({ theme }) => theme.colors.primary},
    0 0 0 9999px rgba(0, 23, 51, 0.62);
  ${motion}

  ${({ $empty }) =>
    $empty &&
    css`
      inset: 50% auto auto 50%;
      width: 0;
      height: 0;
      box-shadow: 0 0 0 9999px rgba(0, 23, 51, 0.62);
    `}
`;

const Card = styled.div<{ $ready: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2002;
  width: min(320px, calc(100vw - ${EDGE * 2}px));
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: 0 16px 40px rgba(0, 23, 51, 0.24);
  visibility: ${({ $ready }) => ($ready ? "visible" : "hidden")};
  ${motion}

  h2 {
    margin-top: 6px;
    font-size: 17px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  }

  p {
    margin-top: 6px;
    font-size: 14px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.textSub};
    word-break: keep-all;
  }
`;

const Count = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
`;

const Dots = styled.span`
  display: flex;
  flex: 1;
  gap: 4px;

  i {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: ${({ theme }) => theme.colors.border};
    transition: width 200ms ease;
  }

  i[data-active] {
    width: 16px;
    background: ${({ theme }) => theme.colors.primary};
  }
`;

const button = css`
  flex-shrink: 0;
  height: 36px;
  padding: 0 14px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 600;
`;

const Ghost = styled.button`
  ${button}
  padding: 0 8px;
  color: ${({ theme }) => theme.colors.textWeak};

  &:hover {
    color: ${({ theme }) => theme.colors.textSub};
  }
`;

const Secondary = styled.button`
  ${button}
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textSub};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const Primary = styled.button`
  ${button}
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;
