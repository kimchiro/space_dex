"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import type { CryptoNews } from "@/lib/news";
import { notices, type NoticeCategory } from "@/data/notices";
import { formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const NEWS_POLL_MS = 120_000;
const NEWS_LIMIT = 6;

type FeedTab = "news" | "notice";

export default function SidebarFeed({ initialNews }: { initialNews: CryptoNews[] }) {
  const [tab, setTab] = useState<FeedTab>("news");
  const [news, setNews] = useState(initialNews);
  const now = useNow();

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/news");
        if (res.ok) setNews(await res.json());
      } catch {}
    }, NEWS_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <Tabs role="tablist">
        <Tab role="tab" aria-selected={tab === "news"} $active={tab === "news"} onClick={() => setTab("news")}>
          <LiveDot aria-hidden />
          실시간 뉴스
        </Tab>
        <Tab role="tab" aria-selected={tab === "notice"} $active={tab === "notice"} onClick={() => setTab("notice")}>
          공지사항
        </Tab>
      </Tabs>

      {tab === "news" ? (
        <List>
          {news.slice(0, NEWS_LIMIT).map((item) => (
            <li key={item.id}>
              <Item href={item.link} target="_blank" rel="noopener noreferrer">
                <Title>{item.title}</Title>
                <Meta>
                  {item.source} · {formatRelativeTime(item.publishedAt, now)}
                </Meta>
              </Item>
            </li>
          ))}
        </List>
      ) : (
        <List>
          {notices.map((notice) => (
            <li key={notice.id}>
              <NoticeItem>
                <NoticeHead>
                  <Badge $category={notice.category}>{notice.category}</Badge>
                  <Meta>{notice.date}</Meta>
                </NoticeHead>
                <Title>{notice.title}</Title>
              </NoticeItem>
            </li>
          ))}
        </List>
      )}
    </Card>
  );
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(240, 68, 82, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(240, 68, 82, 0); }
  100% { box-shadow: 0 0 0 0 rgba(240, 68, 82, 0); }
`;

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 16px;
  padding: 0 4px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textDisabled)};
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.rise};
  animation: ${pulse} 1.8s infinite;
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
`;

const itemBase = `
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 8px;
`;

const Item = styled.a`
  ${itemBase}

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const NoticeItem = styled.div`
  ${itemBase}
`;

const NoticeHead = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Title = styled.p`
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.text};
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const Meta = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Badge = styled.span<{ $category: NoticeCategory }>`
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme, $category }) =>
    $category === "점검" ? theme.colors.rise : $category === "이벤트" ? "#00a36c" : theme.colors.primary};
  background: ${({ theme, $category }) =>
    $category === "점검" ? theme.colors.riseWeak : $category === "이벤트" ? "#e5f8f0" : theme.colors.primaryWeak};
`;
