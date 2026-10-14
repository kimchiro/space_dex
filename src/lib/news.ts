import { cacheLife } from "next/cache";

export type CryptoNews = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

const FEEDS = [
  { source: "블록미디어", url: "https://www.blockmedia.co.kr/feed" },
  { source: "토큰포스트", url: "https://www.tokenpost.kr/rss" },
];

const MAX_ITEMS = 10;
const MAX_PER_SOURCE = 5;

const fallbackNews: CryptoNews[] = [
  { id: "f-1", title: "비트코인, 숏 포지션 대규모 청산 속 반등", link: "#", source: "Space DEX", publishedAt: "2026-10-14T03:00:00Z" },
  { id: "f-2", title: "이더리움 스테이킹 물량 사상 최대치 경신", link: "#", source: "Space DEX", publishedAt: "2026-10-14T02:30:00Z" },
  { id: "f-3", title: "DEX 거래량, 3개월 연속 CEX 대비 점유율 상승", link: "#", source: "Space DEX", publishedAt: "2026-10-14T01:10:00Z" },
  { id: "f-4", title: "솔라나 생태계 신규 토큰 상장 러시", link: "#", source: "Space DEX", publishedAt: "2026-10-13T23:40:00Z" },
  { id: "f-5", title: "스테이블코인 시가총액 2,000억 달러 돌파", link: "#", source: "Space DEX", publishedAt: "2026-10-13T21:20:00Z" },
];

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&(\w+);/g, (match, name) => entities[name] ?? match)
    .trim();
}

function pick(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decode(match[1]) : "";
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<CryptoNews[]> {
  const res = await fetch(feed.url, { headers: { "user-agent": "Mozilla/5.0 (SpaceDEX news reader)" } });
  if (!res.ok) throw new Error(`${feed.source} responded ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const title = pick(item, "title");
    const link = pick(item, "link").split("?utm_")[0];
    const date = new Date(pick(item, "pubDate"));
    if (!title || !link || Number.isNaN(date.getTime())) return [];
    return [{ id: link, title, link, source: feed.source, publishedAt: date.toISOString() }];
  });
}

/** 국내 코인 전문 매체 RSS를 최신순으로 합친다. 서버에서 1분 단위로 갱신된다. */
export async function getCryptoNews(): Promise<CryptoNews[]> {
  "use cache";
  cacheLife("minutes");

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const news = results.flatMap((r) =>
    r.status === "fulfilled"
      ? r.value.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_PER_SOURCE)
      : [],
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[news] ${FEEDS[i].source} 피드를 불러오지 못했습니다.`, r.reason);
  });

  if (news.length === 0) return fallbackNews;

  return news
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ITEMS);
}
