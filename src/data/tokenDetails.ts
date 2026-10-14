import { generateSeries, type Token } from "./tokens";

type TokenProfile = {
  description: string;
  issuer: string;
  launchDate: string;
  maxSupply: number | null;
  circulatingSupply: number;
  contract: string;
  website: string;
};

const profiles: Record<string, TokenProfile> = {
  BTC: { description: "최초의 탈중앙화 디지털 화폐. DEX에서는 이더리움 위의 래핑 토큰(WBTC) 형태로 거래돼요.", issuer: "Satoshi Nakamoto", launchDate: "2009년 1월 3일", maxSupply: 21_000_000, circulatingSupply: 19_780_000, contract: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", website: "bitcoin.org" },
  ETH: { description: "스마트 컨트랙트를 실행하는 범용 블록체인 플랫폼의 기본 자산이에요.", issuer: "Ethereum Foundation", launchDate: "2015년 7월 30일", maxSupply: null, circulatingSupply: 120_400_000, contract: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", website: "ethereum.org" },
  SOL: { description: "높은 처리량과 낮은 수수료를 목표로 하는 레이어1 블록체인 솔라나의 기본 토큰이에요.", issuer: "Solana Labs", launchDate: "2020년 3월 16일", maxSupply: null, circulatingSupply: 475_000_000, contract: "So11111111111111111111111111111111111111112", website: "solana.com" },
  USDC: { description: "미국 달러와 1:1로 가치가 연동되는 규제 기반 스테이블코인이에요.", issuer: "Circle", launchDate: "2018년 9월 26일", maxSupply: null, circulatingSupply: 44_000_000_000, contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", website: "circle.com" },
  USDT: { description: "가장 많이 거래되는 달러 연동 스테이블코인이에요.", issuer: "Tether Limited", launchDate: "2014년 10월 6일", maxSupply: null, circulatingSupply: 120_000_000_000, contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", website: "tether.to" },
  UNI: { description: "대표적인 AMM 탈중앙화 거래소 유니스왑의 거버넌스 토큰이에요.", issuer: "Uniswap Labs", launchDate: "2020년 9월 17일", maxSupply: 1_000_000_000, circulatingSupply: 600_000_000, contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", website: "uniswap.org" },
  PEPE: { description: "인터넷 밈 '개구리 페페'를 모티프로 한 밈코인이에요. 변동성이 매우 커요.", issuer: "커뮤니티", launchDate: "2023년 4월 14일", maxSupply: 420_690_000_000_000, circulatingSupply: 420_690_000_000_000, contract: "0x6982508145454ce325ddbe47a25d4ec3d2311933", website: "pepe.vip" },
};

export function getTokenProfile(token: Token): TokenProfile {
  return (
    profiles[token.symbol] ?? {
      description: `${token.chain} 생태계에서 거래되는 ${token.name}(${token.symbol}) 토큰이에요.`,
      issuer: `${token.name} Foundation`,
      launchDate: "2021년 6월 1일",
      maxSupply: Math.round((token.marketCap / token.price) * 1.4),
      circulatingSupply: Math.round(token.marketCap / token.price),
      contract: `0x${token.symbol.toLowerCase().padEnd(8, "0")}${"a1b2c3d4".repeat(4)}`,
      website: `${token.symbol.toLowerCase()}.org`,
    }
  );
}

export type Holder = { label: string; share: number; color: string };

const holderColors = [
  "#3182f6", "#6fd3a5", "#2ab3a8", "#ffc342", "#ff9500",
  "#f05f2a", "#5ac8fa", "#3a5bc7", "#e5508b", "#9b30d9",
];

const holderLabels = [
  "Uniswap V3 풀",
  "바이낸스 핫월렛",
  "브릿지 컨트랙트",
  "재단 트레저리",
  "Curve 풀",
  "코인베이스 커스터디",
  "Aave 예치",
  "고래 지갑 #1",
  "고래 지갑 #2",
  "팀 베스팅 컨트랙트",
];

export function getTopHolders(token: Token): Holder[] {
  const weights = generateSeries(`${token.symbol}-holders`, 10, 1, 0.35).map(Math.abs);
  const sorted = [...weights].sort((a, b) => b - a);
  const total = sorted.reduce((s, w) => s + w, 0);
  const topShare = 62;
  return sorted.map((w, i) => ({
    label: holderLabels[i],
    share: Math.round((w / total) * topShare * 100) / 100,
    color: holderColors[i],
  }));
}

export type NewsItem = {
  id: string;
  type: "뉴스" | "공시";
  title: string;
  source: string;
  time: string;
};

export function getNews(token: Token): NewsItem[] {
  const n = token.name;
  const s = token.symbol;
  return [
    { id: `${s}-1`, type: "공시", title: `${n}(${s}) 스마트 컨트랙트 업그레이드 일정 안내`, source: `${n} 재단`, time: "10분 전" },
    { id: `${s}-2`, type: "뉴스", title: `${s}, 24시간 DEX 거래량 급증… 대형 지갑 매집 포착`, source: "코인데스크", time: "38분 전" },
    { id: `${s}-3`, type: "뉴스", title: `${n} 생태계 TVL 사상 최고치 경신`, source: "블록미디어", time: "2시간 전" },
    { id: `${s}-4`, type: "공시", title: `${s} 토큰 언락 물량 공개 (다음 달 예정)`, source: "토큰 언락스", time: "5시간 전" },
    { id: `${s}-5`, type: "뉴스", title: `${token.chain} 네트워크 수수료 인하… ${s} 유동성 풀 확대 기대`, source: "디크립트", time: "어제" },
    { id: `${s}-6`, type: "뉴스", title: `기관 투자자, ${n} 관련 상품 출시 검토`, source: "더블록", time: "2일 전" },
    { id: `${s}-7`, type: "공시", title: `${n} 거버넌스 제안 #42 투표 결과 공지`, source: `${n} 거버넌스`, time: "3일 전" },
  ];
}
