"use client";

import { useEffect, type Ref } from "react";
import styled from "styled-components";
import TradingChart, { type ChartHandle } from "@/components/chart/TradingChart";
import type { Drawing, DrawingTool } from "@/components/chart/drawingLayer";
import { useDrawings } from "@/components/chart/drawingsStore";
import type { WorkspacePane } from "@/lib/lab/stores";
import { useScripts } from "@/lib/lab/stores";
import { intervalLabel, marketPair, type Candle } from "@/lib/market/candles";
import { useCandles, type CandlesState } from "@/lib/market/useCandles";
import { useScriptOverlay } from "../useScriptOverlay";

export type PaneFeed = { symbol: string; status: CandlesState["status"]; last: Candle | null };

const TOOL_HINT: Partial<Record<DrawingTool, string>> = {
  trend: "추세선 · 시작점과 끝점을 차례로 클릭하세요",
  hline: "수평선 · 가격 위치를 클릭하세요",
  fib: "피보나치 · 고점과 저점을 차례로 클릭하세요",
};

const NO_DRAWINGS: Drawing[] = [];

export default function ChartPane({
  pane,
  active,
  tool,
  hideDrawings,
  onActivate,
  onDrawingsChange,
  onToolDone,
  onFeed,
  ref,
}: {
  pane: WorkspacePane;
  active: boolean;
  tool: DrawingTool;
  hideDrawings: boolean;
  onActivate: () => void;
  onDrawingsChange: (symbol: string, drawings: Drawing[]) => void;
  onToolDone: () => void;
  onFeed?: (feed: PaneFeed) => void;
  ref?: Ref<ChartHandle>;
}) {
  const scripts = useScripts();
  const script = scripts.find((s) => s.id === pane.scriptId) ?? null;
  const { status, candles, error } = useCandles(pane.symbol, pane.interval, { limit: 500, live: true });
  const overlay = useScriptOverlay(script, candles, pane.symbol, pane.interval);
  const [drawings] = useDrawings(pane.symbol);

  const last = candles[candles.length - 1] ?? null;
  useEffect(() => {
    onFeed?.({ symbol: pane.symbol, status, last });
  }, [onFeed, pane.symbol, status, last]);

  const paneTool = active && !hideDrawings ? tool : "none";
  const title = `${marketPair(pane.symbol)} · ${intervalLabel(pane.interval)}${script ? ` · ${script.name}` : ""}`;

  return (
    <Frame $active={active} onPointerDownCapture={onActivate}>
      <TradingChart
        ref={ref}
        candles={candles}
        title={title}
        indicators={pane.indicators}
        overlays={overlay.overlays}
        markers={overlay.markers}
        priceLines={overlay.priceLines}
        tool={paneTool}
        drawings={hideDrawings ? NO_DRAWINGS : drawings}
        onDrawingsChange={(next) => onDrawingsChange(pane.symbol, next)}
        onToolDone={onToolDone}
        viewKey={`${pane.symbol}:${pane.interval}`}
        height="100%"
      />
      {status !== "ready" && (
        <Overlay>{status === "loading" ? "차트를 불러오는 중…" : status === "unsupported" ? `${marketPair(pane.symbol)}는 Binance 현물에 없어 차트를 그릴 수 없어요.` : error}</Overlay>
      )}
      {paneTool !== "none" && <Hint>{TOOL_HINT[paneTool]}</Hint>}
      {overlay.error && <ErrorTag>{overlay.error}</ErrorTag>}
    </Frame>
  );
}

const Frame = styled.div<{ $active: boolean }>`
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bg};
  outline: ${({ theme, $active }) => ($active ? `2px solid ${theme.colors.primary}` : "none")};
  outline-offset: -2px;
  z-index: ${({ $active }) => ($active ? 1 : 0)};
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Hint = styled.div`
  position: absolute;
  top: 32px;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.text};
  font-size: 12px;
  color: #fff;
  pointer-events: none;
  white-space: nowrap;
`;

const ErrorTag = styled.div`
  position: absolute;
  bottom: 36px;
  left: 8px;
  z-index: 3;
  padding: 4px 8px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.riseWeak};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.rise};
`;
