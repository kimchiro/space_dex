"use client";

import { useState } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { getNews, type NewsItem } from "@/data/tokenDetails";

const filters = ["전체", "뉴스", "공시"] as const;
type Filter = (typeof filters)[number];

export default function NewsList({ token }: { token: Token }) {
  const [filter, setFilter] = useState<Filter>("전체");
  const items = getNews(token).filter((n) => filter === "전체" || n.type === filter);

  return (
    <Card>
      <Head>
        <Title>{token.name} 뉴스 · 공시</Title>
        <Filters>
          {filters.map((f) => (
            <Chip key={f} $active={f === filter} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </Filters>
      </Head>

      <List>
        {items.map((item) => (
          <Item key={item.id}>
            <Badge $type={item.type}>{item.type}</Badge>
            <Body>
              <ItemTitle>{item.title}</ItemTitle>
              <Meta>
                {item.source} · {item.time}
              </Meta>
            </Body>
          </Item>
        ))}
      </List>
    </Card>
  );
}

const Card = styled.div`
  padding: 24px 28px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  font-size: 18px;
  font-weight: 700;
`;

const Filters = styled.div`
  display: flex;
  gap: 6px;
`;

const Chip = styled.button<{ $active: boolean }>`
  height: 30px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.surface)};
`;

const List = styled.ul``;

const Item = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0 -12px;
  padding: 16px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const Badge = styled.span<{ $type: NewsItem["type"] }>`
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme, $type }) => ($type === "공시" ? theme.colors.rise : theme.colors.primary)};
  background: ${({ theme, $type }) => ($type === "공시" ? theme.colors.riseWeak : theme.colors.primaryWeak)};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ItemTitle = styled.p`
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
`;

const Meta = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
