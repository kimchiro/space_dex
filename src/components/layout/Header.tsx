"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { chains } from "@/data/tokens";

const navItems = [
  { href: "/", label: "홈", match: (p: string) => p === "/" },
  { href: "/trade/BTC", label: "거래", match: (p: string) => p.startsWith("/trade") },
  { href: "/pool", label: "유동성 풀", match: (p: string) => p.startsWith("/pool") },
  { href: "/portfolio", label: "내 지갑", match: (p: string) => p.startsWith("/portfolio") },
];

export default function Header() {
  const pathname = usePathname();
  const [chain, setChain] = useState(chains[0]);
  const [chainOpen, setChainOpen] = useState(false);

  return (
    <Wrapper>
      <Inner>
        <MainArea>
          <Left>
            <Logo href="/">
              <LogoMark>S</LogoMark>
              <span>Space DEX</span>
            </Logo>
            <Nav>
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} $active={item.match(pathname)}>
                  {item.label}
                </NavLink>
              ))}
            </Nav>
          </Left>

          <Search>
            <SearchIcon viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </SearchIcon>
            <input placeholder="토큰 이름, 심볼, 컨트랙트 주소 검색" />
            <Kbd>⌘K</Kbd>
          </Search>
        </MainArea>

        <Right>
          <ChainSelector>
            <ChainButton onClick={() => setChainOpen((v) => !v)}>
              <ChainDot />
              {chain}
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
    </Wrapper>
  );
}

const Wrapper = styled.header`
  position: sticky;
  top: 0;
  z-index: 100;
  height: ${({ theme }) => theme.layout.headerHeight};
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Inner = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  height: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: 0 24px;
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

  @media (max-width: 768px) {
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

const Search = styled.label`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  height: 40px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: text;

  @media (max-width: 1024px) {
    display: none;
  }

  input {
    flex: 1;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.text};

    &::placeholder {
      color: ${({ theme }) => theme.colors.textWeak};
    }
  }
`;

const SearchIcon = styled.svg`
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

const Right = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: ${({ theme }) => theme.layout.sidebarWidth};

  @media (max-width: 1100px) {
    width: auto;
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
`;
