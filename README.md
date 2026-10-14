# space_dex

토스증권 UI를 오마주한 개인 코인 DEX 거래 플랫폼입니다.

## 기술 스택

- Next.js (App Router) · React · TypeScript
- styled-components

## 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 화면

- `/` 홈: 오늘의 DEX 시장 요약, 실시간 토큰 차트(정렬·체인 필터·관심 토글)
- `/trade/[symbol]` 거래: 가격 차트, 호가, 구매/판매 스왑 패널
- `/pool`, `/portfolio`: 준비 중

현재 모든 시세 데이터는 `src/data/tokens.ts`의 목업 데이터입니다.
