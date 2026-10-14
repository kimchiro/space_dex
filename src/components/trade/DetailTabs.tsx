"use client";

import styled from "styled-components";

export const detailTabs = [
  { key: "chart", label: "차트 · 호가" },
  { key: "info", label: "코인정보" },
  { key: "news", label: "뉴스 · 공시" },
] as const;

export type DetailTabKey = (typeof detailTabs)[number]["key"];

type Props = {
  value: DetailTabKey;
  onChange: (key: DetailTabKey) => void;
};

export default function DetailTabs({ value, onChange }: Props) {
  return (
    <Wrapper role="tablist">
      {detailTabs.map((tab) => (
        <Tab
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          $active={value === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </Tab>
      ))}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
`;

const Tab = styled.button<{ $active: boolean }>`
  height: 38px;
  padding: 0 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 2px solid ${({ theme, $active }) => ($active ? theme.colors.textSub : "transparent")};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;
