"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styled from "styled-components";
import { CloseIcon, CodeIcon, FlaskIcon, ReplayIcon } from "./terminal/icons";

export type AdvancedTab = "pine" | "backtest" | "replay";

export const ADVANCED_TABS: { key: AdvancedTab; label: string; description: string; icon: (size: number) => ReactNode }[] = [
  { key: "pine", label: "Pine 편집기", description: "지표와 전략을 직접 작성하고 차트에서 미리 봐요", icon: (size) => <CodeIcon size={size} /> },
  { key: "backtest", label: "전략 테스터", description: "과거 시세로 전략의 수익률과 매매 기록을 검증해요", icon: (size) => <FlaskIcon size={size} /> },
  { key: "replay", label: "리플레이 연습", description: "지난 차트를 한 봉씩 재생하며 매매를 연습해요", icon: (size) => <ReplayIcon size={size} /> },
];

export function isAdvancedTab(value: string | null): value is AdvancedTab {
  return ADVANCED_TABS.some((t) => t.key === value);
}

/** 고급 도구를 메뉴 목록과 함께 띄우는 모달. 닫아도 다녀간 화면은 숨겨 둔 채 남겨 작업 내용을 유지한다. */
export default function AdvancedModal({
  open,
  tab,
  pages,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: AdvancedTab;
  pages: Partial<Record<AdvancedTab, ReactNode>>;
  onTabChange: (tab: AdvancedTab) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const active = ADVANCED_TABS.find((t) => t.key === tab) ?? ADVANCED_TABS[0];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <Dialog ref={ref} aria-labelledby="advanced-title" onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Nav aria-label="고급 도구 메뉴">
        <NavTitle>고급 도구</NavTitle>
        <NavList role="tablist" aria-orientation="vertical">
          {ADVANCED_TABS.map((t) => (
            <NavItem key={t.key} type="button" role="tab" aria-selected={t.key === tab} onClick={() => onTabChange(t.key)}>
              <NavIcon>{t.icon(18)}</NavIcon>
              <span>
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </span>
            </NavItem>
          ))}
        </NavList>
      </Nav>

      <Head>
        <HeadIcon>{active.icon(18)}</HeadIcon>
        <div>
          <h2 id="advanced-title">{active.label}</h2>
          <p>{active.description}</p>
        </div>
        <CloseButton type="button" aria-label="고급 도구 닫기" title="닫기 (Esc)" onClick={onClose}>
          <CloseIcon />
        </CloseButton>
      </Head>

      <Body>
        {ADVANCED_TABS.map(
          (t) =>
            pages[t.key] && (
              <Page key={t.key} role="tabpanel" aria-label={t.label} hidden={t.key !== tab}>
                {pages[t.key]}
              </Page>
            ),
        )}
      </Body>
    </Dialog>
  );
}

const SMALL = "(max-width: 720px)";

const Dialog = styled.dialog`
  width: min(1280px, calc(100vw - 48px));
  height: min(880px, calc(100dvh - 48px));
  max-width: none;
  max-height: none;
  margin: auto;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: 0 24px 64px rgba(0, 23, 51, 0.24);
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;

  &[open] {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "nav head"
      "nav body";
  }

  &::backdrop {
    background: rgba(0, 23, 51, 0.45);
  }

  @media ${SMALL} {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;

    &[open] {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr);
      grid-template-areas:
        "head"
        "nav"
        "body";
    }
  }
`;

const Nav = styled.nav`
  grid-area: nav;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 20px 12px;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSub};

  @media ${SMALL} {
    padding: 8px 12px;
    border-right: none;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const NavTitle = styled.p`
  padding: 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};

  @media ${SMALL} {
    display: none;
  }
`;

const NavList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media ${SMALL} {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
  }
`;

const NavIcon = styled.span`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textSub};

  @media ${SMALL} {
    width: auto;
    height: auto;
    background: none;
  }
`;

const NavItem = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: ${({ theme }) => theme.radius.md};
  text-align: left;
  color: ${({ theme }) => theme.colors.text};

  span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  strong {
    font-size: 14px;
    font-weight: 700;
  }

  small {
    font-size: 12px;
    line-height: 1.45;
    color: ${({ theme }) => theme.colors.textWeak};
    word-break: keep-all;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  &[aria-selected="true"] {
    background: ${({ theme }) => theme.colors.primaryWeak};

    strong,
    ${NavIcon} {
      color: ${({ theme }) => theme.colors.primary};
    }
  }

  @media ${SMALL} {
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: ${({ theme }) => theme.radius.full};

    strong {
      font-size: 13px;
      white-space: nowrap;
    }

    small {
      display: none;
    }
  }
`;

const Head = styled.header`
  grid-area: head;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px 16px 16px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  > div {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: 17px;
    font-weight: 700;
  }

  p {
    margin-top: 2px;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textWeak};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media ${SMALL} {
    padding: 12px 8px 12px 16px;

    p {
      display: none;
    }
  }
`;

const HeadIcon = styled.span`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.primaryWeak};
  color: ${({ theme }) => theme.colors.primary};

  @media ${SMALL} {
    display: none;
  }
`;

const CloseButton = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textSub};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Body = styled.div`
  grid-area: body;
  min-width: 0;
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bgSub};

  @media ${SMALL} {
    padding: 12px;
  }
`;

const Page = styled.div`
  &[hidden] {
    display: none;
  }
`;
