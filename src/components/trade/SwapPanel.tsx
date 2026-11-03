"use client";

import { lazy, Suspense } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";

// 주문 서명 모듈은 코인 상세의 거래 패널에서만 불러온다.
const TradeOrder = lazy(() => import("./TradeOrder"));

export default function SwapPanel({ token }: { token: Token }) {
  return (
    <Suspense fallback={<Fallback>주문 화면을 불러오는 중이에요…</Fallback>}>
      <TradeOrder key={token.symbol} token={token} />
    </Suspense>
  );
}

const Fallback = styled.div`
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 14px;
`;
