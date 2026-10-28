import type { Candle } from "@/lib/market/candles";
import { hashText, type InputValue, type PineAnalysis } from "@/lib/pine/analyze";
import { MINTICK, PineRunner, type ExitSpec, type PineOutputs, type StrategyHooks } from "@/lib/pine/runtime";

export type BacktestSettings = {
  initialCapital: number;
  /** 진입마다 쓸 자산 비율(%) */
  qtyPercent: number;
  leverage: number;
  /** 한쪽 거래 수수료(%) */
  feePct: number;
  /** 시장가·손절 체결 시 불리하게 밀리는 정도(%) */
  slippagePct: number;
  /** 8시간당 펀딩 비용(%) — 실제 자료가 없어 가정값으로 표시 */
  fundingPct8h: number;
  /** 뒤쪽 몇 %를 검증 구간으로 떼어낼지 */
  validationPct: number;
};

export const DEFAULT_SETTINGS: BacktestSettings = {
  initialCapital: 10_000,
  qtyPercent: 100,
  leverage: 1,
  feePct: 0.1,
  slippagePct: 0.05,
  fundingPct8h: 0,
  validationPct: 30,
};

export type ExitReason = "청산 신호" | "반대 진입" | "손절" | "익절" | "기간 종료" | "자본 소진";
export type IntrabarMode = "bar" | "magnified" | "assumed";

export type Trade = {
  no: number;
  entryId: string;
  direction: 1 | -1;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  fees: number;
  funding: number;
  pnl: number;
  /** 증거금 대비 수익률(%) */
  pnlPct: number;
  exitReason: ExitReason;
  comment?: string;
  /** 같은 봉에서 손절·익절이 모두 가능했을 때 어떻게 순서를 정했는지 */
  intrabar?: IntrabarMode;
};

export type EquityPoint = { time: number; equity: number };

export type Metrics = {
  netProfit: number;
  returnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  trades: number;
  winRate: number;
  avgTrade: number;
  profitFactor: number;
  fees: number;
  funding: number;
};

export type BacktestResult = {
  trades: Trade[];
  equity: EquityPoint[];
  buyHold: EquityPoint[];
  metrics: { all: Metrics; train: Metrics; test: Metrics };
  boundaryTime: number;
  outputs: PineOutputs;
  /** 손절·익절 순서가 불명확했지만 하위 봉이 없어 기본 규칙을 쓴 봉 */
  ambiguousBars: number[];
  /** 하위 봉으로 순서를 정한 봉 */
  magnifiedBars: number[];
  /** 하위 봉 하나 안에서도 순서가 불명확해 기본 규칙을 쓴 횟수 */
  assumedInSub: number;
  warnings: string[];
  fingerprint: string;
};

type Lot = { entryId: string; dir: 1 | -1; qty: number; price: number; time: number; fee: number; funding: number; comment?: string };
type PendingOrder = { kind: "entry"; id: string; dir: 1 | -1; qty?: number; comment?: string } | { kind: "close"; id: string | null; comment?: string };

export type BacktestInput = {
  analysis: PineAnalysis;
  candles: Candle[];
  inputs?: Record<string, InputValue>;
  settings: BacktestSettings;
  intervalSeconds: number;
  symbol?: string;
  interval?: string;
  subBars?: Map<number, Candle[]>;
};

/** 시가에서 가까운 극값을 먼저 지난다고 보는 TradingView 브로커 에뮬레이터 기본 규칙 */
function barPath(c: Candle) {
  return Math.abs(c.high - c.open) <= Math.abs(c.open - c.low) ? [c.open, c.high, c.low, c.close] : [c.open, c.low, c.high, c.close];
}

export function runBacktest({ analysis, candles, inputs, settings, intervalSeconds, symbol, interval, subBars }: BacktestInput): BacktestResult {
  const fee = settings.feePct / 100;
  const slip = settings.slippagePct / 100;
  const fundingPerBar = (settings.fundingPct8h / 100) * (intervalSeconds / 28_800);
  const pyramiding = Math.max(1, analysis.strategyDefaults.pyramiding ?? 1);

  let cash = settings.initialCapital;
  let realized = 0;
  let lots: Lot[] = [];
  let pending: PendingOrder[] = [];
  const exits = new Map<string, ExitSpec>();
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const ambiguousBars: number[] = [];
  const magnifiedBars: number[] = [];
  const warnings: string[] = [];
  let assumedInSub = 0;
  let stopped = false;
  let bar = 0;

  const unrealized = (price: number) => lots.reduce((sum, l) => sum + l.dir * (price - l.price) * l.qty, 0);
  const avgPrice = () => {
    const qty = lots.reduce((s, l) => s + l.qty, 0);
    return qty ? lots.reduce((s, l) => s + l.price * l.qty, 0) / qty : NaN;
  };

  const closeLots = (targets: Lot[], price: number, reason: ExitReason, applySlip: boolean, comment?: string, intrabar?: IntrabarMode) => {
    const time = candles[bar].time;
    for (const lot of targets) {
      const exitPrice = applySlip ? price * (1 - lot.dir * slip) : price;
      const gross = lot.dir * (exitPrice - lot.price) * lot.qty;
      const exitFee = exitPrice * lot.qty * fee;
      cash += gross - exitFee;
      const pnl = gross - lot.fee - exitFee - lot.funding;
      realized += pnl;
      const margin = (lot.price * lot.qty) / settings.leverage;
      trades.push({
        no: trades.length + 1,
        entryId: lot.entryId,
        direction: lot.dir,
        entryTime: lot.time,
        entryPrice: lot.price,
        exitTime: time,
        exitPrice,
        qty: lot.qty,
        fees: lot.fee + exitFee,
        funding: lot.funding,
        pnl,
        pnlPct: margin ? (pnl / margin) * 100 : 0,
        exitReason: reason,
        comment: comment ?? lot.comment,
        intrabar,
      });
    }
    lots = lots.filter((l) => !targets.includes(l));
    if (lots.length === 0) exits.clear();
  };

  const hooks: StrategyHooks = {
    entry: (id, dir, qty, comment) => {
      pending = pending.filter((o) => !(o.kind === "entry" && o.id === id));
      pending.push({ kind: "entry", id, dir, qty, comment });
    },
    close: (id, comment) => {
      if (lots.some((l) => id === null || l.entryId === id)) pending.push({ kind: "close", id, comment });
    },
    exit: (spec) => {
      exits.set(spec.id, spec);
    },
    positionSize: () => lots.reduce((s, l) => s + l.dir * l.qty, 0),
    avgPrice,
    equity: () => cash + unrealized(candles[bar].close),
    netProfit: () => realized,
    openTrades: () => lots.length,
    closedTrades: () => trades.length,
    initialCapital: () => settings.initialCapital,
  };

  const runner = new PineRunner(analysis, candles, { inputs, hooks, symbol, interval });

  const processOpen = (c: Candle) => {
    const orders = pending;
    pending = [];
    for (const order of orders) {
      if (order.kind === "close") {
        const targets = lots.filter((l) => order.id === null || l.entryId === order.id);
        if (targets.length) closeLots(targets, c.open, "청산 신호", true, order.comment);
        continue;
      }
      if (stopped) continue;
      const opposite = lots.filter((l) => l.dir !== order.dir);
      if (opposite.length) closeLots(opposite, c.open, "반대 진입", true);
      if (lots.length >= pyramiding) continue;

      const fill = c.open * (1 + order.dir * slip);
      const equityNow = cash + unrealized(c.open);
      const qty = order.qty ?? (equityNow * (settings.qtyPercent / 100) * settings.leverage) / fill;
      if (!(qty > 0) || equityNow <= 0) continue;
      const entryFee = fill * qty * fee;
      cash -= entryFee;
      lots.push({ entryId: order.id, dir: order.dir, qty, price: fill, time: c.time, fee: entryFee, funding: 0, comment: order.comment });
    }
  };

  const levelsOf = (spec: ExitSpec, dir: 1 | -1, avg: number) => ({
    stop: spec.stop ?? (spec.loss !== undefined ? avg - dir * spec.loss * MINTICK : undefined),
    limit: spec.limit ?? (spec.profit !== undefined ? avg + dir * spec.profit * MINTICK : undefined),
  });

  /** 평가손익이 현금을 모두 잃는 가격. 이 가격에 닿으면 강제 청산으로 본다. */
  const liquidationPrice = () => {
    const signedQty = lots.reduce((s, l) => s + l.dir * l.qty, 0);
    if (!signedQty) return undefined;
    const p = (lots.reduce((s, l) => s + l.dir * l.price * l.qty, 0) - cash) / signedQty;
    return p > 0 ? p : undefined;
  };

  const stopTrading = (time: number) => {
    stopped = true;
    pending = [];
    warnings.push(
      `${new Date(time * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}에 자산이 0 이하가 되어 강제 청산으로 보고 이후 거래를 멈췄어요. 레버리지·수량 설정을 확인해 주세요.`,
    );
  };

  const processIntrabar = (c: Candle) => {
    if (lots.length === 0) return;
    const dir = lots[0].dir;

    const active = () =>
      [...exits.values()]
        .map((spec) => {
          const targets = lots.filter((l) => spec.from === null || l.entryId === spec.from);
          if (!targets.length) return null;
          const avg = targets.reduce((s, l) => s + l.price * l.qty, 0) / targets.reduce((s, l) => s + l.qty, 0);
          return { spec, targets, ...levelsOf(spec, dir, avg) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    const inRange = (p: number | undefined, lo: number, hi: number) => p !== undefined && p >= lo && p <= hi;
    const ambiguous = active().some((x) => inRange(x.stop, c.low, c.high) && inRange(x.limit, c.low, c.high));
    const sub = ambiguous ? subBars?.get(c.time) : undefined;
    let mode: IntrabarMode = "bar";
    let path: number[];
    if (sub && sub.length) {
      mode = "magnified";
      magnifiedBars.push(c.time);
      path = sub.flatMap(barPath);
      for (const s of sub) {
        if (active().some((x) => inRange(x.stop, s.low, s.high) && inRange(x.limit, s.low, s.high))) assumedInSub++;
      }
    } else {
      if (ambiguous) {
        ambiguousBars.push(c.time);
        mode = "assumed";
      }
      path = barPath(c);
    }

    for (let k = 0; k < path.length - 1 && lots.length; k++) {
      let p0 = path[k];
      const p1 = path[k + 1];
      for (let guard = 0; guard < 8 && lots.length; guard++) {
        type Hit = { dist: number; price: number; kind: "stop" | "limit" | "liquidation"; x?: ReturnType<typeof active>[number] };
        let best: Hit | null = null;
        const check = (level: number | undefined, kind: Hit["kind"], x?: Hit["x"]) => {
          if (level === undefined) return;
          const adverse = kind === "limit" ? dir === -1 : dir === 1;
          const reachedAtStart = adverse ? p0 <= level : p0 >= level;
          const reachedInSegment = adverse ? p1 <= level : p1 >= level;
          if (!reachedAtStart && !reachedInSegment) return;
          const price = reachedAtStart ? p0 : level;
          const dist = Math.abs(price - p0);
          if (!best || dist < best.dist) best = { dist, price, kind, x };
        };
        for (const x of active()) {
          check(x.stop, "stop", x);
          check(x.limit, "limit", x);
        }
        check(liquidationPrice(), "liquidation");
        if (!best) break;
        const hit: Hit = best;
        const tag = mode === "bar" ? undefined : mode;
        if (hit.kind === "liquidation" || !hit.x) {
          closeLots(lots.slice(), hit.price, "자본 소진", false, undefined, tag);
          stopTrading(c.time);
          break;
        }
        exits.delete(hit.x.spec.id);
        closeLots(hit.x.targets, hit.price, hit.kind === "stop" ? "손절" : "익절", hit.kind === "stop", hit.x.spec.comment, tag);
        p0 = hit.price;
      }
    }
  };

  for (bar = 0; bar < candles.length; bar++) {
    const c = candles[bar];
    if (bar > 0) {
      processOpen(c);
      processIntrabar(c);
    }
    for (const lot of lots) {
      const cost = lot.qty * c.close * fundingPerBar;
      lot.funding += cost;
      cash -= cost;
    }
    if (!stopped && cash + unrealized(c.close) <= 0) {
      if (lots.length) closeLots(lots.slice(), c.close, "자본 소진", false);
      stopTrading(c.time);
    }
    runner.runBar(bar);
    if (stopped) pending = [];
    equity.push({ time: c.time, equity: cash + unrealized(c.close) });
  }
  if (lots.length) {
    bar = candles.length - 1;
    closeLots(lots.slice(), candles[bar].close, "기간 종료", false);
    equity[equity.length - 1] = { time: candles[bar].time, equity: cash };
  }

  const first = candles[0]?.close ?? 1;
  const buyHold = candles.map((c) => ({ time: c.time, equity: settings.initialCapital * (c.close / first) }));
  const boundaryIndex = Math.min(candles.length - 1, Math.max(0, Math.floor(candles.length * (1 - settings.validationPct / 100))));
  const boundaryTime = candles[boundaryIndex]?.time ?? 0;

  return {
    trades,
    equity,
    buyHold,
    metrics: {
      all: metricsOf(trades, equity, settings.initialCapital),
      train: metricsOf(
        trades.filter((t) => t.entryTime < boundaryTime),
        equity.slice(0, boundaryIndex + 1),
        settings.initialCapital,
      ),
      test: metricsOf(
        trades.filter((t) => t.entryTime >= boundaryTime),
        equity.slice(boundaryIndex),
        equity[boundaryIndex]?.equity ?? settings.initialCapital,
      ),
    },
    boundaryTime,
    outputs: runner.outputs(),
    ambiguousBars,
    magnifiedBars,
    assumedInSub,
    warnings,
    fingerprint: fingerprintOf(trades),
  };
}

export function metricsOf(trades: Trade[], equity: EquityPoint[], startEquity: number): Metrics {
  const netProfit = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = trades.filter((t) => t.pnl < 0).reduce((s, t) => s - t.pnl, 0);
  let peak = equity[0]?.equity ?? startEquity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const { equity: e } of equity) {
    peak = Math.max(peak, e);
    maxDrawdown = Math.max(maxDrawdown, peak - e);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - e) / peak) * 100);
  }
  return {
    netProfit,
    returnPct: startEquity ? (netProfit / startEquity) * 100 : 0,
    maxDrawdown,
    maxDrawdownPct,
    trades: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgTrade: trades.length ? netProfit / trades.length : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    fees: trades.reduce((s, t) => s + t.fees, 0),
    funding: trades.reduce((s, t) => s + t.funding, 0),
  };
}

/** 같은 데이터·설정이면 같은 값이 나와야 한다. 재현성 확인용. */
export function fingerprintOf(trades: Trade[]) {
  return hashText(
    trades.map((t) => [t.entryTime, t.exitTime, t.direction, t.entryPrice.toFixed(8), t.exitPrice.toFixed(8), t.qty.toFixed(8)].join(",")).join(";"),
  );
}

/**
 * 리페인트(확정 전 신호가 나중에 바뀌는 현상) 점검.
 * 앞부분 데이터만으로 실행한 결과가 전체 데이터로 실행한 결과의 같은 구간과 일치하는지 비교한다.
 */
export function checkRepaint(input: BacktestInput, full: BacktestResult, cutRatio = 0.7) {
  const cut = Math.floor(input.candles.length * cutRatio);
  if (cut < 50) return { ok: true, compared: 0, mismatches: 0 };
  const partial = runBacktest({ ...input, candles: input.candles.slice(0, cut) });
  const lastTime = input.candles[cut - 1].time;
  const key = (t: Trade) => `${t.entryTime}|${t.exitTime}|${t.entryPrice.toFixed(8)}|${t.exitPrice.toFixed(8)}`;
  const closedBefore = (t: Trade) => t.exitTime < lastTime && t.exitReason !== "기간 종료";
  const a = partial.trades.filter(closedBefore).map(key);
  const b = new Set(full.trades.filter(closedBefore).map(key));
  const mismatches = a.filter((k) => !b.has(k)).length;
  return { ok: mismatches === 0, compared: a.length, mismatches };
}
