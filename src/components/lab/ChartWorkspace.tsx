"use client";

import { useState } from "react";
import styled from "styled-components";
import ChartToolbar from "@/components/chart/ChartToolbar";
import TradingChart, { DEFAULT_INDICATORS } from "@/components/chart/TradingChart";
import type { DrawingTool } from "@/components/chart/drawingLayer";
import { useDrawings } from "@/components/chart/drawingsStore";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import { newId, useScripts, workspaceStore, type Workspace, type WorkspacePane } from "@/lib/lab/stores";
import { marketPair, type IntervalKey } from "@/lib/market/candles";
import { useCandles } from "@/lib/market/useCandles";
import { useRecentViewed } from "@/lib/recentViewed";
import SymbolSelect from "./SymbolSelect";
import { Badge, Button, Card, Muted, Row, Select } from "./ui";
import { useScriptOverlay } from "./useScriptOverlay";

const LAYOUTS = [1, 2, 4] as const;
const HEIGHTS = { 1: 560, 2: 440, 4: 300 } as const;

function defaultWorkspace(symbol: string, interval: IntervalKey): Workspace {
  const pane = (s: string, i: IntervalKey): WorkspacePane => ({ id: newId(), symbol: s, interval: i, indicators: DEFAULT_INDICATORS, scriptId: null });
  return {
    layout: 2,
    panes: [pane(symbol, interval), pane(symbol, interval === "4h" ? "1d" : "4h"), pane("ETH", interval), pane("SOL", interval)],
    savedAt: null,
  };
}

export default function ChartWorkspace({ symbol, interval }: { symbol: string; interval: IntervalKey }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => workspaceStore.read() ?? defaultWorkspace(symbol, interval));
  const [activeIndex, setActiveIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const { watchlist } = useWatchlist();
  const recent = useRecentViewed();

  const update = (next: Workspace) => {
    setWorkspace(next);
    setDirty(true);
  };
  const updatePane = (index: number, patch: Partial<WorkspacePane>) =>
    update({ ...workspace, panes: workspace.panes.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const save = () => {
    const saved = { ...workspace, savedAt: Date.now() };
    workspaceStore.write(saved);
    setWorkspace(saved);
    setDirty(false);
  };

  const visible = workspace.panes.slice(0, workspace.layout);
  const quickSymbols = [...new Set([...watchlist, ...recent])].slice(0, 12);

  return (
    <Layout>
      <Main>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              {LAYOUTS.map((n) => (
                <Button key={n} type="button" $size="sm" $variant={workspace.layout === n ? "primary" : "secondary"} onClick={() => update({ ...workspace, layout: n })}>
                  {n === 1 ? "1화면" : n === 2 ? "2분할" : "4분할"}
                </Button>
              ))}
              <Muted>차트를 클릭해 선택한 뒤, 오른쪽 관심목록에서 종목을 바꿀 수 있어요.</Muted>
            </Row>
            <Row>
              <Muted>{dirty ? "저장하지 않은 변경이 있어요" : workspace.savedAt ? `${new Date(workspace.savedAt).toLocaleString("ko-KR")} 저장됨` : "기본 레이아웃"}</Muted>
              <Button type="button" $size="sm" $variant="primary" onClick={save} disabled={!dirty}>
                레이아웃 저장
              </Button>
            </Row>
          </Row>
        </Card>
        <PaneGrid $layout={workspace.layout}>
          {visible.map((pane, i) => (
            <ChartPane
              key={pane.id}
              pane={pane}
              active={i === activeIndex}
              height={HEIGHTS[workspace.layout]}
              onActivate={() => setActiveIndex(i)}
              onChange={(patch) => updatePane(i, patch)}
            />
          ))}
        </PaneGrid>
      </Main>

      <Side>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <strong>관심목록</strong>
            <Badge $tone="info">{activeIndex + 1}번 차트에 적용</Badge>
          </Row>
          <SymbolList>
            {quickSymbols.map((s) => (
              <li key={s}>
                <SymbolButton type="button" $active={visible[activeIndex]?.symbol === s} onClick={() => updatePane(activeIndex, { symbol: s })}>
                  <strong>{s}</strong>
                  <span>{watchlist.includes(s) ? "관심" : "최근 본"}</span>
                </SymbolButton>
              </li>
            ))}
          </SymbolList>
          <Muted>관심 종목은 코인 상세 화면의 &lsquo;관심 추가&rsquo;로 늘릴 수 있어요.</Muted>
        </Card>
      </Side>
    </Layout>
  );
}

function ChartPane({
  pane,
  active,
  height,
  onActivate,
  onChange,
}: {
  pane: WorkspacePane;
  active: boolean;
  height: number;
  onActivate: () => void;
  onChange: (patch: Partial<WorkspacePane>) => void;
}) {
  const scripts = useScripts();
  const script = scripts.find((s) => s.id === pane.scriptId) ?? null;
  const { status, candles, error } = useCandles(pane.symbol, pane.interval, { limit: 500, live: true });
  const overlay = useScriptOverlay(script, candles, pane.symbol, pane.interval);
  const [tool, setTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useDrawings(pane.symbol);

  return (
    <PaneCard $active={active} onPointerDown={onActivate}>
      <Row $gap={6}>
        <PaneControl>
          <SymbolSelect value={pane.symbol} onChange={(symbol) => onChange({ symbol })} />
        </PaneControl>
        <PaneControl>
          <Select aria-label="내 지표·전략" value={pane.scriptId ?? ""} onChange={(e) => onChange({ scriptId: e.target.value || null })}>
            <option value="">내 지표·전략 없음</option>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kind === "strategy" ? "[전략] " : "[지표] "}
                {s.name}
              </option>
            ))}
          </Select>
        </PaneControl>
        <Muted>{marketPair(pane.symbol)}</Muted>
      </Row>
      <ChartToolbar
        interval={pane.interval}
        onInterval={(interval) => onChange({ interval })}
        indicators={pane.indicators}
        onIndicators={(indicators) => onChange({ indicators })}
        tool={tool}
        onTool={setTool}
        drawingCount={drawings.length}
        onClearDrawings={() => setDrawings([])}
      />
      <ChartBox>
        <TradingChart
          candles={candles}
          indicators={pane.indicators}
          overlays={overlay.overlays}
          markers={overlay.markers}
          priceLines={overlay.priceLines}
          tool={tool}
          drawings={drawings}
          onDrawingsChange={setDrawings}
          onToolDone={() => setTool("none")}
          viewKey={`${pane.symbol}:${pane.interval}`}
          height={height}
        />
        {status !== "ready" && (
          <Overlay>
            {status === "loading" ? "불러오는 중…" : status === "unsupported" ? `${marketPair(pane.symbol)} 마켓 데이터가 없어요.` : error}
          </Overlay>
        )}
      </ChartBox>
      {overlay.error && <Muted style={{ color: "#f04452" }}>{overlay.error}</Muted>}
    </PaneCard>
  );
}

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  align-items: start;

  @container main (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`;

const Side = styled.aside`
  position: sticky;
  top: calc(${({ theme }) => theme.layout.headerHeight} + 24px);

  @container main (max-width: 900px) {
    position: static;
  }
`;

const PaneGrid = styled.div<{ $layout: 1 | 2 | 4 }>`
  display: grid;
  grid-template-columns: ${({ $layout }) => ($layout === 1 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))")};
  gap: 12px;

  @container main (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const PaneCard = styled(Card)<{ $active: boolean }>`
  gap: 10px;
  padding: 14px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
`;

const ChartBox = styled.div`
  position: relative;
`;

const PaneControl = styled.div`
  flex: 1 1 140px;
  max-width: 200px;
  min-width: 0;

  select {
    width: 100%;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSub};
`;

const SymbolList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SymbolButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : "transparent")};
  font-size: 14px;

  span {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;
