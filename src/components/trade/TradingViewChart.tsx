"use client";

import Link from "next/link";
import { useState } from "react";
import styled from "styled-components";
import ChartToolbar from "@/components/chart/ChartToolbar";
import TradingChart, { DEFAULT_INDICATORS, type IndicatorConfig } from "@/components/chart/TradingChart";
import type { DrawingTool } from "@/components/chart/drawingLayer";
import { useDrawings } from "@/components/chart/drawingsStore";
import type { Token } from "@/data/tokens";
import { DATA_SOURCE, marketPair, type IntervalKey } from "@/lib/market/candles";
import { useCandles } from "@/lib/market/useCandles";
import PriceChart from "./PriceChart";

/** 바이낸스 USDT 마켓이 있는 코인은 캔들 차트, 없으면 코인게코 가격 차트로 대체한다. */
export default function TradingViewChart({ token }: { token: Token }) {
  const [interval, setChartInterval] = useState<IntervalKey>("1h");
  const [indicators, setIndicators] = useState<IndicatorConfig>(DEFAULT_INDICATORS);
  const [tool, setTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useDrawings(token.symbol);
  const { status, candles, error } = useCandles(token.symbol, interval, { limit: 500, live: true });

  if (status === "unsupported") return <PriceChart token={token} />;

  return (
    <Card>
      <ChartToolbar
        interval={interval}
        onInterval={setChartInterval}
        indicators={indicators}
        onIndicators={setIndicators}
        tool={tool}
        onTool={setTool}
        drawingCount={drawings.length}
        onClearDrawings={() => setDrawings([])}
        trailing={
          <LabLink href={`/lab?symbol=${token.symbol}&interval=${interval}`}>전략 실험실 →</LabLink>
        }
      />
      <ChartArea>
        <TradingChart
          candles={candles}
          indicators={indicators}
          tool={tool}
          drawings={drawings}
          onDrawingsChange={setDrawings}
          onToolDone={() => setTool("none")}
          viewKey={`${token.symbol}:${interval}`}
          height={440}
        />
        {status === "loading" && <Overlay>차트를 불러오는 중…</Overlay>}
        {status === "error" && <Overlay>{error}</Overlay>}
      </ChartArea>
      <Source>
        {DATA_SOURCE} {marketPair(token.symbol)} · 5초마다 갱신 · 차트 TradingView Lightweight Charts
      </Source>
    </Card>
  );
}

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
`;

const ChartArea = styled.div`
  position: relative;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSub};
`;

const LabLink = styled(Link)`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const Source = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
