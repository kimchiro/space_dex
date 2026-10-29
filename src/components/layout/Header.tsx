"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { chains } from "@/data/tokens";
import HeaderSearch from "./HeaderSearch";

const navItems = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/trade/BTC", label: "거래", match: (p: string) => p.startsWith("/trade") },
  { href: "/lab", label: "전략 실험실", match: (p: string) => p.startsWith("/lab") },
  { href: "/pool", label: "유동성 풀", match: (p: string) => p.startsWith("/pool") },
  { href: "/portfolio", label: "내 지갑", match: (p: string) => p.startsWith("/portfolio") },
];

/** fluid: 화면 전체를 쓰는 페이지에서 본문과 같은 너비·여백으로 맞춘다. */
export default function Header({ fluid = false }: { fluid?: boolean }) {
  const pathname = usePathname();
  const [chain, setChain] = useState(chains[0]);
  const [chainOpen, setChainOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Wrapper>
      <Inner $fluid={fluid}>
        <MainArea>
          <Left>
            <Logo href="/">
              <LogoMark>S</LogoMark>
              <span>Space DEX</span>
            </Logo>
            <Nav aria-label="주요 메뉴">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} $active={item.match(pathname)}>
                  {item.label}
                </NavLink>
              ))}
            </Nav>
          </Left>

          <DesktopSearch>
            <HeaderSearch />
          </DesktopSearch>
        </MainArea>

        <Right>
          <SearchToggle type="button" aria-label={searchOpen ? "검색 닫기" : "코인 검색"} aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {searchOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </>
              )}
            </svg>
          </SearchToggle>
          <ChainSelector>
            <ChainButton aria-label={`네트워크: ${chain}`} onClick={() => setChainOpen((v) => !v)}>
              <ChainDot />
              <ChainName>{chain}</ChainName>
              <Caret $open={chainOpen}>▾</Caret>
            </ChainButton>
            {chainOpen && (
              <ChainMenu>
                {chains.map((c) => (
                  <li key={c}>
                    <ChainOption
                      $active={c === chain}
                      onClick={() => {
                        setChain(c);
                        setChainOpen(false);
                      }}
                    >
                      {c}
                    </ChainOption>
                  </li>
                ))}
              </ChainMenu>
            )}
          </ChainSelector>
          <ConnectButton>지갑 연결</ConnectButton>
        </Right>
      </Inner>

      {searchOpen && (
        <SearchRow $fluid={fluid}>
          <HeaderSearch autoFocus onClose={() => setSearchOpen(false)} />
        </SearchRow>
      )}

      <MobileNav aria-label="주요 메뉴" $fluid={fluid}>
        {navItems.map((item) => (
          <MobileNavLink key={item.href} href={item.href} $active={item.match(pathname)} aria-current={item.match(pathname) ? "page" : undefined}>
            {item.label}
          </MobileNavLink>
        ))}
      </MobileNav>
    </Wrapper>
  );
}

// 메뉴가 한 줄에 들어가지 않는 폭부터 메뉴를 둘째 줄로, 검색창이 들어갈 자리가 없는 폭부터 검색을 아이콘으로 바꾼다.
const NAV_ROW = "(max-width: 900px)";
const SEARCH_ICON = "(max-width: 1100px)";
const SMALL = "(max-width: 420px)";

const gutter = ({ $fluid }: { $fluid: boolean }) => ($fluid ? "16px" : "24px");

const Wrapper = styled.header`
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Inner = styled.div<{ $fluid: boolean }>`
  display: flex;
  align-items: center;
  gap: 24px;
  height: ${({ theme }) => theme.layout.headerHeight};
  max-width: ${({ theme, $fluid }) => ($fluid ? "none" : theme.layout.maxWidth)};
  margin: 0 auto;
  padding: 0 ${gutter};

  @media ${NAV_ROW} {
    height: 56px;
    gap: 12px;
  }

  @media ${SMALL} {
    padding: 0 16px;
  }
`;

const DesktopSearch = styled.div`
  flex: 1;
  max-width: 420px;

  @media ${SEARCH_ICON} {
    display: none;
  }
`;

const SearchToggle = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textSub};

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  &:hover,
  &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }

  @media ${SEARCH_ICON} {
    display: inline-flex;
  }
`;

const SearchRow = styled.div<{ $fluid: boolean }>`
  display: none;
  max-width: ${({ theme, $fluid }) => ($fluid ? "none" : theme.layout.maxWidth)};
  margin: 0 auto;
  padding: 0 ${gutter} 12px;

  @media ${SEARCH_ICON} {
    display: block;
  }

  @media ${SMALL} {
    padding: 0 16px 12px;
  }
`;

const MobileNav = styled.nav<{ $fluid: boolean }>`
  display: none;
  gap: 4px;
  max-width: ${({ theme, $fluid }) => ($fluid ? "none" : theme.layout.maxWidth)};
  margin: 0 auto;
  padding: 0 ${gutter};
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media ${NAV_ROW} {
    display: flex;
  }

  @media ${SMALL} {
    padding: 0 8px;
  }
`;

const MobileNavLink = styled(Link)<{ $active: boolean }>`
  position: relative;
  flex-shrink: 0;
  padding: 10px 10px 12px;
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  white-space: nowrap;

  &::after {
    content: "";
    position: absolute;
    right: 10px;
    bottom: 0;
    left: 10px;
    height: 2px;
    border-radius: 1px;
    background: ${({ theme, $active }) => ($active ? theme.colors.text : "transparent")};
  }
`;

const MainArea = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
  white-space: nowrap;
`;

const LogoMark = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3182f6, #7b5cff);
  color: #fff;
  font-size: 15px;
`;

const Nav = styled.nav`
  display: flex;
  gap: 4px;

  @media ${NAV_ROW} {
    display: none;
  }
`;

const NavLink = styled(Link)<{ $active: boolean }>`
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Right = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: ${({ theme }) => theme.layout.sidebarWidth};

  @media ${SEARCH_ICON} {
    width: auto;
  }

  @media ${SMALL} {
    gap: 4px;
  }
`;

const ChainName = styled.span`
  @media ${SMALL} {
    display: none;
  }
`;

const ChainSelector = styled.div`
  position: relative;
`;

const ChainButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  @media ${SMALL} {
    padding: 0 8px;
  }
`;

const ChainDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00c896;
`;

const Caret = styled.span<{ $open: boolean }>`
  font-size: 11px;
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0")});
  transition: transform 0.15s;
`;

const ChainMenu = styled.ul`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  padding: 6px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: ${({ theme }) => theme.shadow.popover};
`;

const ChainOption = styled.button<{ $active: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  text-align: left;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const ConnectButton = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }

  @media ${SMALL} {
    padding: 0 12px;
    font-size: 13px;
  }
`;
