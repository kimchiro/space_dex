"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { DEFAULT_INDICATORS, type ChartHandle, type IndicatorConfig } from "@/components/chart/TradingChart";
import type { Drawing, DrawingTool } from "@/components/chart/drawingLayer";
import { readDrawings, useDrawings, writeDrawings } from "@/components/chart/drawingsStore";
import TokenIcon from "@/components/common/TokenIcon";
import { useMarket } from "@/components/providers/MarketProvider";
import { useWatchlist } from "@/components/providers/WatchlistProvider";
import MarketDepth from "@/components/trade/MarketDepth";
import { formatCompact } from "@/lib/format";
import { SAMPLE_SCRIPT, newId, useScripts, workspaceStore, type Workspace, type WorkspacePane } from "@/lib/lab/stores";
import { DATA_SOURCE, INTERVALS, isIntervalKey, marketPair, type IntervalKey } from "@/lib/market/candles";
import { useNow } from "@/lib/useNow";
import PineLab from "./PineLab";
import ChartPane, { type PaneFeed } from "./terminal/ChartPane";
import Dropdown, { MenuCheck, MenuDivider, MenuItem, MenuLabel } from "./terminal/Dropdown";
import MarketPanel, { formatQuote } from "./terminal/MarketPanel";
import NewsPanel from "./terminal/NewsPanel";
import {
  BookIcon,
  CameraIcon,
  ChevronDown,
  CloseIcon,
  CodeIcon,
  CrosshairIcon,
  ExpandIcon,
  EyeIcon,
  EyeOffIcon,
  FibIcon,
  FlaskIcon,
  HLineIcon,
  IndicatorIcon,
  LayoutIcon,
  ListIcon,
  NewsIcon,
  RedoIcon,
  ReplayIcon,
  SaveIcon,
  ShrinkIcon,
  TrashIcon,
  TrendIcon,
  UndoIcon,
} from "./terminal/icons";

// 기본 기간·시작 시점을 현재 시각으로 잡으므로 서버 렌더와 어긋나지 않게 브라우저에서만 그린다.
const BacktestLab = dynamic(() => import("./BacktestLab"), { ssr: false });
const ReplayLab = dynamic(() => import("./ReplayLab"), { ssr: false });

type SideTab = "market" | "depth" | "news";
type DockTab = "pine" | "backtest" | "replay";
type DockSize = "closed" | "half" | "max";
type History = Record<string, { past: Drawing[][]; future: Drawing[][] }>;

const DOCK_TABS: { key: DockTab; label: string; icon: ReactNode }[] = [
  { key: "pine", label: "Pine 편집기", icon: <CodeIcon size={16} /> },
  { key: "backtest", label: "전략 테스터", icon: <FlaskIcon size={16} /> },
  { key: "replay", label: "리플레이 연습", icon: <ReplayIcon size={16} /> },
];

const SIDE_TABS: { key: SideTab; label: string; icon: ReactNode }[] = [
  { key: "market", label: "종목", icon: <ListIcon /> },
  { key: "depth", label: "호가", icon: <BookIcon /> },
  { key: "news", label: "뉴스", icon: <NewsIcon /> },
];

const DRAW_TOOLS: { key: DrawingTool; label: string; icon: ReactNode }[] = [
  { key: "none", label: "십자 커서", icon: <CrosshairIcon /> },
  { key: "trend", label: "추세선", icon: <TrendIcon /> },
  { key: "hline", label: "수평선", icon: <HLineIcon /> },
  { key: "fib", label: "피보나치 되돌림", icon: <FibIcon /> },
];

const INDICATOR_OPTIONS: { key: keyof IndicatorConfig; label: string }[] = [
  { key: "volume", label: "거래량" },
  { key: "ma", label: "이동평균선 20·60" },
  { key: "bb", label: "볼린저 밴드 20·2" },
  { key: "rsi", label: "RSI 14" },
];

const LAYOUTS: { count: 1 | 2 | 4; label: string }[] = [
  { count: 1, label: "1화면" },
  { count: 2, label: "2분할" },
  { count: 4, label: "4분할" },
];

const kstClock = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

function defaultWorkspace(symbol: string, interval: IntervalKey): Workspace {
  const pane = (s: string, i: IntervalKey): WorkspacePane => ({ id: newId(), symbol: s, interval: i, indicators: DEFAULT_INDICATORS, scriptId: null });
  return {
    layout: 1,
    panes: [pane(symbol, interval), pane("ETH", interval), pane("SOL", interval), pane("XRP", interval)],
    savedAt: null,
  };
}

function initialWorkspace(symbol: string | null, interval: IntervalKey | null): Workspace {
  const base = workspaceStore.read() ?? defaultWorkspace(symbol ?? "BTC", interval ?? "15m");
  if (!symbol && !interval) return base;
  const [first, ...rest] = base.panes;
  return { ...base, panes: [{ ...first, symbol: symbol ?? first.symbol, interval: interval ?? first.interval }, ...rest] };
}

export default function LabView() {
  const params = useSearchParams();
  const { findToken } = useMarket();
  const { watchlist } = useWatchlist();
  const scripts = useScripts();
  const now = useNow();

  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const interval = params.get("interval");
    return initialWorkspace(params.get("symbol")?.toUpperCase() ?? null, isIntervalKey(interval) ? interval : null);
  });
  const [dirty, setDirty] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tool, setTool] = useState<DrawingTool>("none");
  const [hideDrawings, setHideDrawings] = useState(false);
  const [history, setHistory] = useState<History>({});
  const [feed, setFeed] = useState<PaneFeed | null>(null);
  const [side, setSide] = useState<SideTab | null>(() => (window.innerWidth >= 1100 ? "market" : null));
  const [dock, setDock] = useState<{ tab: DockTab; size: DockSize; visited: DockTab[] }>(() => {
    const tab = params.get("tab");
    return tab === "pine" || tab === "backtest" || tab === "replay" ? { tab, size: "half", visited: [tab] } : { tab: "pine", size: "closed", visited: [] };
  });
  const [scriptId, setScriptId] = useState(SAMPLE_SCRIPT.id);
  const [fullscreen, setFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const paneRefs = useRef<(ChartHandle | null)[]>([]);

  const visible = workspace.panes.slice(0, workspace.layout);
  const activePane = visible[Math.min(activeIndex, visible.length - 1)];
  const symbol = activePane.symbol;
  const token = findToken(symbol);
  const [drawings] = useDrawings(symbol);
  const symbolHistory = history[symbol];

  const update = (next: Workspace) => {
    setWorkspace(next);
    setDirty(true);
  };
  const updateActive = (patch: Partial<WorkspacePane>) =>
    update({ ...workspace, panes: workspace.panes.map((p) => (p.id === activePane.id ? { ...p, ...patch } : p)) });

  const saveLayout = () => {
    const saved = { ...workspace, savedAt: Date.now() };
    workspaceStore.write(saved);
    setWorkspace(saved);
    setDirty(false);
  };

  const commitDrawings = useCallback((target: string, next: Drawing[]) => {
    const prev = readDrawings(target);
    setHistory((h) => ({ ...h, [target]: { past: [...(h[target]?.past ?? []), prev].slice(-50), future: [] } }));
    writeDrawings(target, next);
  }, []);

  const undo = useCallback(() => {
    const h = symbolHistory;
    if (!h?.past.length) return;
    const current = readDrawings(symbol);
    setHistory((all) => ({ ...all, [symbol]: { past: h.past.slice(0, -1), future: [...h.future, current] } }));
    writeDrawings(symbol, h.past[h.past.length - 1]);
  }, [symbol, symbolHistory]);

  const redo = useCallback(() => {
    const h = symbolHistory;
    if (!h?.future.length) return;
    const current = readDrawings(symbol);
    setHistory((all) => ({ ...all, [symbol]: { past: [...h.past, current], future: h.future.slice(0, -1) } }));
    writeDrawings(symbol, h.future[h.future.length - 1]);
  }, [symbol, symbolHistory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") setTool("none");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen();
  };

  const screenshot = () => {
    const url = paneRefs.current[activeIndex]?.screenshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol}-${activePane.interval}-${Date.now()}.png`;
    a.click();
  };

  const openDock = (tab: DockTab) =>
    setDock((d) => ({ tab, size: d.size === "closed" ? "half" : d.size, visited: d.visited.includes(tab) ? d.visited : [...d.visited, tab] }));

  const openSide = (tab: SideTab) => setSide((s) => (s === tab ? null : tab));

  const focusSearch = () => {
    setSide("market");
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const activeScript = scripts.find((s) => s.id === activePane.scriptId);
  const price = feed?.symbol === symbol && feed.last ? feed.last.close : token?.price;
  const change = token?.change24h ?? 0;
  const range = token?.high24h && token.low24h && price ? Math.min(1, Math.max(0, (price - token.low24h) / (token.high24h - token.low24h))) : null;
  const status = feed?.symbol === symbol ? feed.status : "loading";

  return (
    <Terminal ref={rootRef} $side={side !== null} $fullscreen={fullscreen}>
      <TopBar>
        <SymbolButton type="button" onClick={focusSearch} aria-label="종목 바꾸기">
          {token && <TokenIcon symbol={token.symbol} color={token.color} image={token.image} size={26} />}
          <span>
            <strong>{symbol}</strong>
            <small>USDT 현물</small>
          </span>
          <ChevronDown />
        </SymbolButton>
        <PriceBlock $value={change}>
          <strong>{price !== undefined ? formatQuote(price) : "-"}</strong>
          <span>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </PriceBlock>
        <Status $status={status}>
          <i />
          {status === "ready" ? "실시간 연결 · 5초마다 갱신" : status === "loading" ? "연결 중…" : status === "unsupported" ? "Binance 현물 미상장" : "연결이 끊겼어요 · 다시 연결 중"}
        </Status>
        <Stats>
          {token?.low24h !== undefined && token.high24h !== undefined && (
            <Stat>
              <dt>24시간 범위</dt>
              <dd>
                <RangeBar>
                  <span>{formatQuote(token.low24h)}</span>
                  <i>{range !== null && <b style={{ left: `${range * 100}%` }} />}</i>
                  <span>{formatQuote(token.high24h)}</span>
                </RangeBar>
              </dd>
            </Stat>
          )}
          <Stat>
            <dt>24시간 거래대금</dt>
            <dd>{token ? formatCompact(token.volume24h) : "-"}</dd>
          </Stat>
          <Stat>
            <dt>시가총액</dt>
            <dd>{token ? formatCompact(token.marketCap) : "-"}</dd>
          </Stat>
        </Stats>
        <TopActions>
          <Link href={`/trade/${symbol}`}>코인 상세로 →</Link>
        </TopActions>
      </TopBar>

      <ChartBar>
        <Group role="group" aria-label="시간봉">
          {INTERVALS.map((i) => (
            <Chip key={i.key} type="button" $active={activePane.interval === i.key} onClick={() => updateActive({ interval: i.key })}>
              {i.label}
            </Chip>
          ))}
        </Group>
        <Divider />
        <Dropdown
          label="보조지표"
          trigger={() => (
            <>
              <IndicatorIcon size={16} /> 지표 <ChevronDown />
            </>
          )}
        >
          {() => (
            <>
              <MenuLabel>{activeIndex + 1}번 차트 보조지표</MenuLabel>
              {INDICATOR_OPTIONS.map((o) => (
                <MenuItem key={o.key} type="button" onClick={() => updateActive({ indicators: { ...activePane.indicators, [o.key]: !activePane.indicators[o.key] } })}>
                  <MenuCheck $on={activePane.indicators[o.key]}>{activePane.indicators[o.key] ? "✓" : ""}</MenuCheck>
                  {o.label}
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown
          label="내 지표·전략"
          trigger={() => (
            <>
              <CodeIcon size={16} /> {activeScript ? activeScript.name : "내 지표·전략"} <ChevronDown />
            </>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Pine으로 만든 지표·전략</MenuLabel>
              <MenuItem
                type="button"
                $active={!activePane.scriptId}
                onClick={() => {
                  updateActive({ scriptId: null });
                  close();
                }}
              >
                표시 안 함
              </MenuItem>
              {scripts.map((s) => (
                <MenuItem
                  key={s.id}
                  type="button"
                  $active={activePane.scriptId === s.id}
                  onClick={() => {
                    updateActive({ scriptId: s.id });
                    close();
                  }}
                >
                  {s.name}
                  <small>{s.kind === "strategy" ? "전략" : "지표"}</small>
                </MenuItem>
              ))}
              <MenuDivider />
              <MenuItem
                type="button"
                onClick={() => {
                  openDock("pine");
                  close();
                }}
              >
                + Pine 편집기에서 새로 만들기
              </MenuItem>
            </>
          )}
        </Dropdown>
        <Divider />
        <Dropdown
          label="화면 분할"
          trigger={() => (
            <>
              <LayoutIcon count={workspace.layout} size={16} /> 화면 분할 <ChevronDown />
            </>
          )}
        >
          {(close) =>
            LAYOUTS.map((l) => (
              <MenuItem
                key={l.count}
                type="button"
                $active={workspace.layout === l.count}
                onClick={() => {
                  update({ ...workspace, layout: l.count });
                  if (activeIndex >= l.count) setActiveIndex(0);
                  close();
                }}
              >
                <LayoutIcon count={l.count} size={16} />
                {l.label}
              </MenuItem>
            ))
          }
        </Dropdown>
        <BarButton type="button" onClick={saveLayout} disabled={!dirty} title={workspace.savedAt ? `${new Date(workspace.savedAt).toLocaleString("ko-KR")} 저장됨` : "아직 저장하지 않았어요"}>
          <SaveIcon size={16} />
          레이아웃 저장
          {dirty && <Dot />}
        </BarButton>
        <Clock>{now ? kstClock.format(now) : "--:--"} KST</Clock>
        <Spacer />
        <IconButton type="button" title="실행 취소 (⌘Z)" aria-label="실행 취소" onClick={undo} disabled={!symbolHistory?.past.length}>
          <UndoIcon size={16} />
        </IconButton>
        <IconButton type="button" title="다시 실행 (⇧⌘Z)" aria-label="다시 실행" onClick={redo} disabled={!symbolHistory?.future.length}>
          <RedoIcon size={16} />
        </IconButton>
        <IconButton type="button" title="차트 이미지 저장" aria-label="차트 이미지 저장" onClick={screenshot}>
          <CameraIcon size={16} />
        </IconButton>
        <IconButton type="button" title={fullscreen ? "전체 화면 끝내기" : "전체 화면"} aria-label="전체 화면" onClick={toggleFullscreen}>
          {fullscreen ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
        </IconButton>
      </ChartBar>

      <Tools aria-label="작도 도구">
        {DRAW_TOOLS.map((t) => (
          <ToolButton key={t.key} type="button" title={t.label} aria-label={t.label} aria-pressed={tool === t.key} onClick={() => setTool(t.key)} disabled={hideDrawings && t.key !== "none"}>
            {t.icon}
          </ToolButton>
        ))}
        <ToolDivider />
        <ToolButton type="button" title={hideDrawings ? "작도 보이기" : "작도 숨기기"} aria-label="작도 숨기기" aria-pressed={hideDrawings} onClick={() => setHideDrawings((h) => !h)}>
          {hideDrawings ? <EyeOffIcon /> : <EyeIcon />}
        </ToolButton>
        <ToolButton type="button" title={`${symbol} 작도 모두 지우기`} aria-label="작도 모두 지우기" onClick={() => commitDrawings(symbol, [])} disabled={drawings.length === 0}>
          <TrashIcon />
        </ToolButton>
      </Tools>

      <Center>
        <Grid $layout={workspace.layout} $hidden={dock.size === "max"}>
          {visible.map((pane, i) => (
            <ChartPane
              key={pane.id}
              ref={(handle) => {
                paneRefs.current[i] = handle;
              }}
              pane={pane}
              active={pane.id === activePane.id}
              tool={tool}
              hideDrawings={hideDrawings}
              onActivate={() => setActiveIndex(i)}
              onDrawingsChange={commitDrawings}
              onToolDone={() => setTool("none")}
              onFeed={pane.id === activePane.id ? setFeed : undefined}
            />
          ))}
        </Grid>

        <Dock $size={dock.size}>
          <DockBar>
            {DOCK_TABS.map((t) => (
              <DockTabButton
                key={t.key}
                type="button"
                $active={dock.size !== "closed" && dock.tab === t.key}
                onClick={() => (dock.size !== "closed" && dock.tab === t.key ? setDock((d) => ({ ...d, size: "closed" })) : openDock(t.key))}
              >
                {t.icon}
                {t.label}
              </DockTabButton>
            ))}
            <Spacer />
            {dock.size !== "closed" && (
              <>
                <IconButton type="button" title={dock.size === "max" ? "차트와 함께 보기" : "패널 크게 보기"} aria-label="패널 크기" onClick={() => setDock((d) => ({ ...d, size: d.size === "max" ? "half" : "max" }))}>
                  {dock.size === "max" ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
                </IconButton>
                <IconButton type="button" title="패널 닫기" aria-label="패널 닫기" onClick={() => setDock((d) => ({ ...d, size: "closed" }))}>
                  <CloseIcon />
                </IconButton>
              </>
            )}
          </DockBar>
          {dock.size !== "closed" && (
            <DockBody>
              {dock.visited.includes("pine") && (
                <DockPage hidden={dock.tab !== "pine"}>
                  <PineLab
                    symbol={symbol}
                    interval={activePane.interval}
                    onBacktest={(id) => {
                      setScriptId(id);
                      openDock("backtest");
                    }}
                  />
                </DockPage>
              )}
              {dock.visited.includes("backtest") && (
                <DockPage hidden={dock.tab !== "backtest"}>
                  <BacktestLab
                    symbol={symbol}
                    interval={activePane.interval}
                    scriptId={scriptId}
                    onScriptChange={setScriptId}
                    onMarketChange={(s, i) => updateActive({ symbol: s, interval: i })}
                    onReplay={() => openDock("replay")}
                  />
                </DockPage>
              )}
              {dock.visited.includes("replay") && (
                <DockPage hidden={dock.tab !== "replay"}>
                  <ReplayLab symbol={symbol} interval={activePane.interval} scriptId={scriptId} />
                </DockPage>
              )}
            </DockBody>
          )}
        </Dock>
      </Center>

      {side && (
        <Side>
          {side === "market" && <MarketPanel active={symbol} onSelect={(s) => updateActive({ symbol: s })} searchRef={searchRef} />}
          {side === "depth" && (token ? <MarketDepth token={token} plain /> : <SideEmpty>시세 정보가 없는 종목이에요.</SideEmpty>)}
          {side === "news" && <NewsPanel />}
        </Side>
      )}

      <Rail aria-label="패널">
        {SIDE_TABS.map((t) => (
          <RailButton key={t.key} type="button" aria-pressed={side === t.key} onClick={() => openSide(t.key)}>
            {t.icon}
            <span>{t.label}</span>
          </RailButton>
        ))}
        <RailDivider />
        {DOCK_TABS.map((t) => (
          <RailButton key={t.key} type="button" aria-pressed={dock.size !== "closed" && dock.tab === t.key} onClick={() => openDock(t.key)}>
            {t.icon}
            <span>{t.key === "pine" ? "Pine" : t.key === "backtest" ? "백테스트" : "리플레이"}</span>
          </RailButton>
        ))}
      </Rail>

      <Ticker>
        {watchlist.map((s) => {
          const t = findToken(s);
          if (!t) return null;
          return (
            <TickerItem key={s} type="button" onClick={() => updateActive({ symbol: s })}>
              <TokenIcon symbol={t.symbol} color={t.color} image={t.image} size={14} />
              <strong>{s}</strong>
              <span>{formatQuote(t.price)}</span>
              <TickerChange $value={t.change24h}>
                {t.change24h > 0 ? "+" : ""}
                {t.change24h.toFixed(2)}%
              </TickerChange>
            </TickerItem>
          );
        })}
        <Spacer />
        <span>
          {DATA_SOURCE} {marketPair(symbol)}
        </span>
        <span>KST {now ? kstClock.format(now) : "--:--"}</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
          차트 제공 TradingView
        </a>
      </Ticker>
    </Terminal>
  );
}

const Terminal = styled.div<{ $side: boolean; $fullscreen: boolean }>`
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) ${({ $side }) => ($side ? "320px" : "0")} 56px;
  grid-template-rows: auto auto minmax(0, 1fr) 30px;
  grid-template-areas:
    "top top top rail"
    "bar bar side rail"
    "tools center side rail"
    "foot foot foot foot";
  position: relative;
  height: 100%;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};

  ${({ $fullscreen }) =>
    $fullscreen &&
    css`
      height: 100vh;
    `}

  @container main (max-width: 900px) {
    grid-template-columns: 44px minmax(0, 1fr) 0 56px;
  }
`;

const TopBar = styled.div`
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
  padding: 8px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow-x: auto;
  scrollbar-width: none;
`;

const SymbolButton = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textWeak};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  span {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
  }

  strong {
    font-size: 16px;
    font-weight: 800;
    color: ${({ theme }) => theme.colors.text};
  }

  small {
    font-size: 11px;
  }
`;

const PriceBlock = styled.div<{ $value: number }>`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $value }) => ($value > 0 ? theme.colors.rise : $value < 0 ? theme.colors.fall : theme.colors.text)};

  strong {
    font-size: 18px;
    font-weight: 800;
  }

  span {
    font-size: 12px;
    font-weight: 600;
  }
`;

const Status = styled.span<{ $status: string }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme, $status }) => ($status === "ready" ? theme.colors.primary : $status === "error" ? theme.colors.rise : theme.colors.textWeak)};
  background: ${({ theme, $status }) => ($status === "ready" ? theme.colors.primaryWeak : $status === "error" ? theme.colors.riseWeak : theme.colors.surface)};

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`;

const Stats = styled.dl`
  display: flex;
  flex-shrink: 0;
  gap: 24px;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  dt {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  dd {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const RangeBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSub};

  i {
    position: relative;
    width: 90px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, ${({ theme }) => theme.colors.fall}, ${({ theme }) => theme.colors.rise});
  }

  b {
    position: absolute;
    top: -3px;
    width: 3px;
    height: 10px;
    margin-left: -1.5px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.text};
  }
`;

const TopActions = styled.div`
  flex-shrink: 0;
  margin-left: auto;

  a {
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ChartBar = styled.div`
  grid-area: bar;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 42px;
  padding: 0 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow-x: auto;
  scrollbar-width: none;
`;

const Group = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 2px;
`;

const Chip = styled.button<{ $active: boolean }>`
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : "transparent")};

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.surface)};
  }
`;

const Divider = styled.span`
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: ${({ theme }) => theme.colors.border};
`;

const BarButton = styled.button`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    color: ${({ theme }) => theme.colors.textDisabled};
  }
`;

const Dot = styled.i`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
`;

const Clock = styled.span`
  flex-shrink: 0;
  padding: 0 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Spacer = styled.span`
  flex: 1;
`;

const IconButton = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: ${({ theme }) => theme.colors.textSub};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    color: ${({ theme }) => theme.colors.textDisabled};
  }
`;

const Tools = styled.nav`
  grid-area: tools;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`;

const ToolButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  color: ${({ theme }) => theme.colors.textSub};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }

  &[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.primaryWeak};
    color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    color: ${({ theme }) => theme.colors.textDisabled};
  }
`;

const ToolDivider = styled.hr`
  width: 24px;
  margin: 6px 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Center = styled.div`
  grid-area: center;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
`;

const GRID_TEMPLATES = {
  1: "grid-template: minmax(0, 1fr) / minmax(0, 1fr);",
  2: "grid-template: minmax(0, 1fr) / repeat(2, minmax(0, 1fr));",
  4: "grid-template: repeat(2, minmax(0, 1fr)) / repeat(2, minmax(0, 1fr));",
} as const;

const Grid = styled.div<{ $layout: 1 | 2 | 4; $hidden: boolean }>`
  display: ${({ $hidden }) => ($hidden ? "none" : "grid")};
  ${({ $layout }) => GRID_TEMPLATES[$layout]}
  flex: 1;
  gap: 1px;
  min-height: 0;
  background: ${({ theme }) => theme.colors.border};
`;

const Dock = styled.section<{ $size: DockSize }>`
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  ${({ $size }) => ($size === "half" ? "height: 48%;" : $size === "max" ? "flex: 1;" : "")}
`;

const DockBar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  height: 38px;
  flex-shrink: 0;
  padding: 0 8px;
  background: ${({ theme }) => theme.colors.bg};
`;

const DockTabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : "transparent")};

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.surface)};
  }
`;

const DockBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSub};
`;

const DockPage = styled.div`
  &[hidden] {
    display: none;
  }
`;

const Side = styled.aside`
  grid-area: side;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid ${({ theme }) => theme.colors.border};

  @container main (max-width: 900px) {
    grid-area: auto;
    position: absolute;
    top: 0;
    right: 56px;
    bottom: 30px;
    z-index: 20;
    width: min(320px, calc(100% - 56px));
    background: ${({ theme }) => theme.colors.bg};
    box-shadow: ${({ theme }) => theme.shadow.popover};
  }
`;

const SideEmpty = styled.p`
  padding: 32px 14px;
  font-size: 13px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Rail = styled.nav`
  grid-area: rail;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  overflow-y: auto;
`;

const RailButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 48px;
  padding: 6px 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textSub};

  span {
    font-size: 10px;
    font-weight: 600;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  &[aria-pressed="true"] {
    color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryWeak};
  }
`;

const RailDivider = styled.hr`
  width: 28px;
  margin: 6px 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Ticker = styled.footer`
  grid-area: foot;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 0 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSub};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;

  a {
    color: ${({ theme }) => theme.colors.textSub};
  }
`;

const TickerItem = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textSub};

  strong {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const TickerChange = styled.span<{ $value: number }>`
  font-weight: 600;
  color: ${({ theme, $value }) => ($value > 0 ? theme.colors.rise : $value < 0 ? theme.colors.fall : theme.colors.textWeak)};
`;
