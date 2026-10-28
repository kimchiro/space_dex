"use client";

import type { IndicatorConfig } from "@/components/chart/TradingChart";
import type { BacktestSettings, Metrics, Trade } from "@/lib/backtest/engine";
import type { MagnifierReport } from "@/lib/backtest/magnifier";
import { createLocalStore } from "@/lib/localStore";
import type { IntervalKey } from "@/lib/market/candles";
import type { InputValue } from "@/lib/pine/analyze";
import { MA_CROSS_STRATEGY } from "@/lib/pine/samples";

export type RightsBasis = "own" | "open-source" | "permission";

export type SavedScript = {
  id: string;
  name: string;
  kind: "indicator" | "strategy";
  /** 사용자가 넣은 원본 코드 */
  source: string;
  /** v5로 변환된 코드 */
  code: string;
  hash: string;
  revision: number;
  inputs: Record<string, InputValue>;
  rights: { basis: RightsBasis; note: string };
  savedAt: number;
};

export const SAMPLE_SCRIPT: SavedScript = {
  id: "sample:ma-cross",
  name: "예시 · EMA 교차 전략",
  kind: "strategy",
  source: MA_CROSS_STRATEGY,
  code: MA_CROSS_STRATEGY,
  hash: "sample",
  revision: 1,
  inputs: {},
  rights: { basis: "own", note: "SPACEDEX 제공 예시" },
  savedAt: 0,
};

export const scriptsStore = createLocalStore<SavedScript[]>("space-dex:lab:scripts", []);

export function useScripts() {
  const saved = scriptsStore.useValue();
  return [SAMPLE_SCRIPT, ...saved];
}

export type SavedRun = {
  id: string;
  createdAt: number;
  script: { id: string; name: string; hash: string; revision: number; inputs: Record<string, InputValue> };
  symbol: string;
  interval: IntervalKey;
  data: { source: string; from: number; to: number; bars: number };
  settings: BacktestSettings;
  magnifier: { enabled: boolean; report?: MagnifierReport };
  assumptions: string[];
  metrics: { all: Metrics; train: Metrics; test: Metrics };
  fingerprint: string;
  trades: Trade[];
};

export const runsStore = createLocalStore<SavedRun[]>("space-dex:lab:runs", []);

export type ReplayOrder = { id: string; side: 1 | -1; type: "limit"; price: number; amount: number; stop?: number; take?: number };
export type ReplayPosition = { side: 1 | -1; qty: number; entryPrice: number; entryTime: number; stop?: number; take?: number };
export type ReplayTrade = {
  id: string;
  side: 1 | -1;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  reason: string;
  memo: string;
};

export type ReplaySession = {
  id: string;
  name: string;
  symbol: string;
  interval: IntervalKey;
  startTime: number;
  cursorTime: number;
  compare: { symbol: string; interval: IntervalKey } | null;
  scriptId: string | null;
  balance: number;
  position: ReplayPosition | null;
  orders: ReplayOrder[];
  trades: ReplayTrade[];
  notes: string;
  savedAt: number;
};

export const replayStore = createLocalStore<ReplaySession[]>("space-dex:lab:replays", []);

export type WorkspacePane = { id: string; symbol: string; interval: IntervalKey; indicators: IndicatorConfig; scriptId: string | null };
/** layout: 화면에 보이는 차트 수(1~6). panes 앞에서부터 layout개를 띄운다. */
export type Workspace = { layout: number; panes: WorkspacePane[]; savedAt: number | null };

export const workspaceStore = createLocalStore<Workspace | null>("space-dex:lab:workspace", null);

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
