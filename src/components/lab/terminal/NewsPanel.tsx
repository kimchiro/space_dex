"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { formatRelativeTime } from "@/lib/format";
import type { CryptoNews } from "@/lib/news";
import { useNow } from "@/lib/useNow";

export default function NewsPanel() {
  const [news, setNews] = useState<CryptoNews[] | null>(null);
  const now = useNow();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then(setNews)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!news) return <Empty>뉴스를 불러오는 중…</Empty>;
  if (news.length === 0) return <Empty>지금은 뉴스를 불러올 수 없어요.</Empty>;

  return (
    <List>
      {news.map((item) => (
        <li key={item.id}>
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            <strong>{item.title}</strong>
            <span>
              {item.source} · {formatRelativeTime(item.publishedAt, now)}
            </span>
          </a>
        </li>
      ))}
    </List>
  );
}

const List = styled.ul`
  height: 100%;
  overflow-y: auto;

  a {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  a:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }

  strong {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.45;
    color: ${({ theme }) => theme.colors.text};
  }

  span {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Empty = styled.p`
  padding: 32px 14px;
  font-size: 13px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
`;
