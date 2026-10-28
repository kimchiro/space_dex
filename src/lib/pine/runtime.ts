import type { ChartMarker } from "@/components/chart/TradingChart";
import type { Candle } from "@/lib/market/candles";
import type { Expr, Program, Stmt } from "./ast";
import type { InputValue, PineAnalysis } from "./analyze";
import { ASSUMED_VARIABLES, COLORS, CONSTANT_PREFIXES, FUNCTIONS, STRATEGY_CONSTANTS } from "./builtins";

type Value = number | boolean | string | Value[] | undefined;

export type ExitSpec = { id: string; from: string | null; stop?: number; limit?: number; profit?: number; loss?: number; comment?: string };

/** 전략 함수가 호출하는 주문 처리기. 백테스트 엔진이 구현한다. */
export type StrategyHooks = {
  entry: (id: string, direction: 1 | -1, qty: number | undefined, comment?: string) => void;
  close: (id: string | null, comment?: string) => void;
  exit: (spec: ExitSpec) => void;
  positionSize: () => number;
  avgPrice: () => number;
  equity: () => number;
  netProfit: () => number;
  openTrades: () => number;
  closedTrades: () => number;
  initialCapital: () => number;
};

export type PlotOutput = { id: string; title: string; color: string; values: number[]; colors: (string | undefined)[] };
export type HLineOutput = { price: number; title: string; color: string };
export type PineOutputs = { plots: PlotOutput[]; markers: ChartMarker[]; hlines: HLineOutput[] };

export class PineRuntimeError extends Error {
  constructor(
    public readonly line: number | null,
    message: string,
  ) {
    super(message);
  }
}

export const MINTICK = 0.01;
const DEFAULT_TIME_LIMIT_MS = 3_000;

type SmoothState = { prev: number; seed: number; count: number };
const newSmooth = (): SmoothState => ({ prev: NaN, seed: 0, count: 0 });
function smoothStep(s: SmoothState, value: number, length: number, alpha: number) {
  if (Number.isNaN(value)) return s.prev;
  if (Number.isNaN(s.prev)) {
    s.seed += value;
    s.count++;
    if (s.count >= length) s.prev = s.seed / s.count;
    return s.prev;
  }
  s.prev = alpha * value + (1 - alpha) * s.prev;
  return s.prev;
}

const num = (v: Value): number => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : NaN);
const truthy = (v: Value) => (typeof v === "boolean" ? v : typeof v === "number" ? !Number.isNaN(v) && v !== 0 : typeof v === "string" ? v.length > 0 : false);
const isNa = (v: Value) => v === undefined || (typeof v === "number" && Number.isNaN(v));

function withAlpha(color: Value, transp: number) {
  if (typeof color !== "string") return undefined;
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, 1 - transp / 100))})`;
}

const SHAPE_MAP: Record<string, ChartMarker["shape"]> = {
  "shape.triangleup": "arrowUp",
  "shape.arrowup": "arrowUp",
  "shape.labelup": "arrowUp",
  "shape.triangledown": "arrowDown",
  "shape.arrowdown": "arrowDown",
  "shape.labeldown": "arrowDown",
  "shape.circle": "circle",
};

/**
 * Pine v5 부분집합 실행기. TradingView처럼 봉마다 스크립트 전체를 한 번 실행하며,
 * 각 봉의 종가가 확정된 뒤의 값만 사용한다(미래 봉 접근 불가).
 */
export class PineRunner {
  private readonly program: Program;
  private readonly vars = new Map<string, Value[]>();
  private readonly persistent = new Set<string>();
  private readonly state = new Map<number, Record<string, unknown>>();
  private readonly plots = new Map<number, PlotOutput>();
  private readonly hlines = new Map<number, HLineOutput>();
  private readonly markers: ChartMarker[] = [];
  private i = 0;
  private readonly startedAt = Date.now();

  constructor(
    private readonly analysis: PineAnalysis,
    private readonly candles: Candle[],
    private readonly options: {
      inputs?: Record<string, InputValue>;
      hooks?: StrategyHooks;
      symbol?: string;
      interval?: string;
      timeLimitMs?: number;
    } = {},
  ) {
    if (!analysis.program) throw new PineRuntimeError(null, "오류가 있는 코드는 실행할 수 없어요.");
    this.program = analysis.program;
  }

  runBar(i: number) {
    this.i = i;
    if (Date.now() - this.startedAt > (this.options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS)) {
      throw new PineRuntimeError(null, `실행 시간 제한(${(this.options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS) / 1000}초)을 넘어 중단했어요.`);
    }
    if (i > 0) {
      for (const name of this.persistent) {
        const series = this.vars.get(name)!;
        series[i] = series[i - 1];
      }
    }
    this.exec(this.program);
  }

  runAll() {
    for (let i = 0; i < this.candles.length; i++) this.runBar(i);
    return this.outputs();
  }

  outputs(): PineOutputs {
    return { plots: [...this.plots.values()], markers: this.markers, hlines: [...this.hlines.values()] };
  }

  private exec(stmts: Stmt[]) {
    for (const s of stmts) {
      try {
        switch (s.t) {
          case "assign":
            if (s.mode === "var") {
              if (!this.persistent.has(s.name)) {
                this.persistent.add(s.name);
                this.set(s.name, this.eval(s.e));
              }
            } else this.set(s.name, this.eval(s.e));
            break;
          case "tuple": {
            const v = this.eval(s.e);
            const values = Array.isArray(v) ? v : [];
            s.names.forEach((name, k) => this.set(name, values[k]));
            break;
          }
          case "expr":
            this.eval(s.e);
            break;
          case "if":
            this.exec(truthy(this.eval(s.cond)) ? s.then : s.else);
            break;
        }
      } catch (error) {
        if (error instanceof PineRuntimeError && error.line === null && s.t !== "if") {
          throw new PineRuntimeError(s.line, error.message);
        }
        throw error;
      }
    }
  }

  private set(name: string, value: Value) {
    let series = this.vars.get(name);
    if (!series) {
      series = [];
      this.vars.set(name, series);
    }
    series[this.i] = value;
  }

  private lookup(name: string, offset: number): Value {
    const at = this.i - offset;
    if (at < 0) return NaN;
    const series = this.vars.get(name);
    if (series) return series[at] ?? NaN;

    const c = this.candles[at];
    switch (name) {
      case "open":
        return c.open;
      case "high":
        return c.high;
      case "low":
        return c.low;
      case "close":
        return c.close;
      case "volume":
        return c.volume;
      case "hl2":
        return (c.high + c.low) / 2;
      case "hlc3":
        return (c.high + c.low + c.close) / 3;
      case "ohlc4":
        return (c.open + c.high + c.low + c.close) / 4;
      case "hlcc4":
        return (c.high + c.low + 2 * c.close) / 4;
      case "bar_index":
        return at;
      case "time":
        return c.time * 1000;
    }

    if (name.startsWith("strategy.") && !STRATEGY_CONSTANTS.includes(name)) {
      const hooks = this.options.hooks;
      if (offset !== 0) return NaN;
      switch (name) {
        case "strategy.position_size":
          return hooks?.positionSize() ?? 0;
        case "strategy.position_avg_price":
          return hooks?.avgPrice() ?? NaN;
        case "strategy.equity":
          return hooks?.equity() ?? NaN;
        case "strategy.netprofit":
          return hooks?.netProfit() ?? 0;
        case "strategy.opentrades":
          return hooks?.openTrades() ?? 0;
        case "strategy.closedtrades":
          return hooks?.closedTrades() ?? 0;
        case "strategy.initial_capital":
          return hooks?.initialCapital() ?? NaN;
      }
    }
    if (name in COLORS) return COLORS[name];
    if (name === "syminfo.mintick") return MINTICK;
    if (name === "syminfo.ticker") return this.options.symbol ?? "";
    if (name === "timeframe.period") return this.options.interval ?? "";
    if (STRATEGY_CONSTANTS.includes(name) || CONSTANT_PREFIXES.some((p) => name.startsWith(p)) || name in ASSUMED_VARIABLES) return name;
    return NaN;
  }

  private nodeState<T extends Record<string, unknown>>(id: number, init: () => T): T {
    let s = this.state.get(id) as T | undefined;
    if (!s) {
      s = init();
      this.state.set(id, s);
    }
    return s;
  }

  /** 호출 위치별로 봉 순서대로 값을 쌓아 length개 구간을 꺼낸다. */
  private windowOf(id: number, key: string, value: number, length: number) {
    const s = this.nodeState(id, () => ({}) as Record<string, number[]>);
    const buf = (s[key] ??= []);
    buf[this.i] = value;
    if (!(length >= 1) || this.i - length + 1 < 0) return null;
    const out: number[] = [];
    for (let j = this.i - length + 1; j <= this.i; j++) {
      const v = buf[j];
      if (v === undefined || Number.isNaN(v)) return null;
      out.push(v);
    }
    return out;
  }

  private eval(e: Expr): Value {
    switch (e.k) {
      case "num":
        return e.v;
      case "str":
        return e.v;
      case "bool":
        return e.v;
      case "na":
        return NaN;
      case "id":
        return this.lookup(e.name, 0);
      case "hist": {
        const offset = Math.floor(num(this.eval(e.offset)));
        if (!(offset >= 0)) throw new PineRuntimeError(e.line, "과거 값 참조 [n]의 n은 0 이상이어야 해요.");
        if (e.e.k === "id") return this.lookup(e.e.name, offset);
        const s = this.nodeState(e.id, () => ({ buf: [] as Value[] }));
        s.buf[this.i] = this.eval(e.e);
        return this.i - offset >= 0 ? (s.buf[this.i - offset] ?? NaN) : NaN;
      }
      case "un": {
        const v = this.eval(e.e);
        if (e.op === "not") return !truthy(v);
        return e.op === "-" ? -num(v) : num(v);
      }
      case "bin":
        return this.binary(e.op, e.l, e.r);
      case "tern":
        return truthy(this.eval(e.c)) ? this.eval(e.a) : this.eval(e.b);
      case "call":
        return this.call(e);
    }
  }

  private binary(op: string, le: Expr, re: Expr): Value {
    if (op === "and") return truthy(this.eval(le)) && truthy(this.eval(re));
    if (op === "or") return truthy(this.eval(le)) || truthy(this.eval(re));
    const l = this.eval(le);
    const r = this.eval(re);
    if (op === "+" && (typeof l === "string" || typeof r === "string")) return `${l ?? ""}${r ?? ""}`;
    if (op === "==") return typeof l === "string" || typeof r === "string" ? l === r : num(l) === num(r);
    if (op === "!=") return typeof l === "string" || typeof r === "string" ? l !== r : !(num(l) === num(r)) && !isNa(l) && !isNa(r);
    const a = num(l);
    const b = num(r);
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? NaN : a / b;
      case "%":
        return b === 0 ? NaN : a % b;
      case "<":
        return a < b;
      case ">":
        return a > b;
      case "<=":
        return a <= b;
      case ">=":
        return a >= b;
    }
    throw new PineRuntimeError(null, `지원하지 않는 연산자 ${op}`);
  }

  private call(e: Extract<Expr, { k: "call" }>): Value {
    const params = FUNCTIONS[e.name]?.params ?? [];
    const argExpr = (name: string, fallbackIndex?: number) => {
      if (e.named[name]) return e.named[name];
      const index = params.indexOf(name);
      return e.args[index >= 0 ? index : (fallbackIndex ?? -1)];
    };
    const arg = (name: string): Value => {
      const ex = argExpr(name);
      return ex ? this.eval(ex) : undefined;
    };
    const numArg = (name: string, fallback = NaN) => {
      const v = arg(name);
      return v === undefined ? fallback : num(v);
    };
    const str = (name: string) => {
      const v = arg(name);
      return typeof v === "string" ? v : undefined;
    };

    switch (e.name) {
      case "indicator":
      case "strategy":
        return undefined;

      case "ta.sma":
      case "ta.wma":
      case "ta.stdev":
      case "ta.highest":
      case "ta.lowest": {
        let source: number;
        let length: number;
        if ((e.name === "ta.highest" || e.name === "ta.lowest") && e.args.length === 1 && !e.named.source) {
          source = num(this.lookup(e.name === "ta.highest" ? "high" : "low", 0));
          length = num(this.eval(e.args[0]));
        } else {
          source = numArg("source");
          length = numArg("length");
        }
        const w = this.windowOf(e.id, "src", source, Math.floor(length));
        if (!w) return NaN;
        if (e.name === "ta.sma") return w.reduce((a, b) => a + b, 0) / w.length;
        if (e.name === "ta.highest") return Math.max(...w);
        if (e.name === "ta.lowest") return Math.min(...w);
        if (e.name === "ta.wma") {
          const denom = (w.length * (w.length + 1)) / 2;
          return w.reduce((sum, v, k) => sum + v * (k + 1), 0) / denom;
        }
        const mean = w.reduce((a, b) => a + b, 0) / w.length;
        return Math.sqrt(w.reduce((sum, v) => sum + (v - mean) ** 2, 0) / w.length);
      }

      case "ta.ema":
      case "ta.rma": {
        const length = numArg("length");
        const s = this.nodeState(e.id, newSmooth);
        return smoothStep(s, numArg("source"), length, e.name === "ta.ema" ? 2 / (length + 1) : 1 / length);
      }

      case "ta.rsi": {
        const length = numArg("length");
        const source = numArg("source");
        const s = this.nodeState(e.id, () => ({ last: NaN, up: newSmooth(), down: newSmooth() }));
        const change = source - s.last;
        s.last = source;
        if (Number.isNaN(change)) return NaN;
        const up = smoothStep(s.up, Math.max(change, 0), length, 1 / length);
        const down = smoothStep(s.down, Math.max(-change, 0), length, 1 / length);
        if (Number.isNaN(up) || Number.isNaN(down)) return NaN;
        if (down === 0) return 100;
        if (up === 0) return 0;
        return 100 - 100 / (1 + up / down);
      }

      case "ta.atr": {
        const length = numArg("length");
        const c = this.candles[this.i];
        const prev = this.candles[this.i - 1];
        const tr = prev ? Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)) : c.high - c.low;
        return smoothStep(this.nodeState(e.id, newSmooth), tr, length, 1 / length);
      }

      case "ta.change": {
        const source = numArg("source");
        const length = Math.floor(numArg("length", 1));
        const s = this.nodeState(e.id, () => ({ buf: [] as number[] }));
        s.buf[this.i] = source;
        const past = s.buf[this.i - length];
        return past === undefined ? NaN : source - past;
      }

      case "ta.crossover":
      case "ta.crossunder":
      case "ta.cross": {
        const a = numArg("source1");
        const b = numArg("source2");
        const s = this.nodeState(e.id, () => ({ a: NaN, b: NaN }));
        const up = a > b && s.a <= s.b;
        const down = a < b && s.a >= s.b;
        s.a = a;
        s.b = b;
        return e.name === "ta.crossover" ? up : e.name === "ta.crossunder" ? down : up || down;
      }

      case "ta.bb": {
        const source = numArg("series");
        const length = Math.floor(numArg("length"));
        const mult = numArg("mult");
        const w = this.windowOf(e.id, "src", source, length);
        if (!w) return [NaN, NaN, NaN];
        const basis = w.reduce((a, b) => a + b, 0) / w.length;
        const dev = Math.sqrt(w.reduce((sum, v) => sum + (v - basis) ** 2, 0) / w.length);
        return [basis, basis + mult * dev, basis - mult * dev];
      }

      case "ta.macd": {
        const source = numArg("source");
        const fast = numArg("fastlen");
        const slow = numArg("slowlen");
        const sig = numArg("siglen");
        const s = this.nodeState(e.id, () => ({ fast: newSmooth(), slow: newSmooth(), signal: newSmooth() }));
        const macd = smoothStep(s.fast, source, fast, 2 / (fast + 1)) - smoothStep(s.slow, source, slow, 2 / (slow + 1));
        const signal = Number.isNaN(macd) ? NaN : smoothStep(s.signal, macd, sig, 2 / (sig + 1));
        return [macd, signal, macd - signal];
      }

      case "math.abs":
        return Math.abs(numArg("number"));
      case "math.max":
        return Math.max(...e.args.map((a) => num(this.eval(a))));
      case "math.min":
        return Math.min(...e.args.map((a) => num(this.eval(a))));
      case "math.round": {
        const precision = numArg("precision", 0);
        const f = 10 ** precision;
        return Math.round(numArg("number") * f) / f;
      }
      case "math.floor":
        return Math.floor(numArg("number"));
      case "math.ceil":
        return Math.ceil(numArg("number"));
      case "math.sqrt":
        return Math.sqrt(numArg("number"));
      case "math.pow":
        return numArg("base") ** numArg("exponent");
      case "math.log":
        return Math.log(numArg("number"));
      case "nz": {
        const v = arg("source");
        return isNa(v) ? (arg("replacement") ?? 0) : v;
      }
      case "na":
        return isNa(arg("x"));

      case "input":
      case "input.int":
      case "input.float":
      case "input.bool":
      case "input.source":
      case "input.string": {
        const override = this.options.inputs?.[`in${e.id}`];
        if (override !== undefined) {
          const isSource = this.analysis.inputs.find((i) => i.key === `in${e.id}`)?.type === "source";
          return isSource && typeof override === "string" ? this.lookup(override, 0) : override;
        }
        return arg("defval");
      }

      case "color.new":
        return withAlpha(arg("color"), numArg("transp", 0));
      case "color.rgb": {
        const [r, g, b] = ["red", "green", "blue"].map((n) => Math.round(numArg(n)));
        return `rgba(${r}, ${g}, ${b}, ${1 - numArg("transp", 0) / 100})`;
      }
      case "str.tostring": {
        const v = arg("value");
        return typeof v === "number" ? (Number.isNaN(v) ? "NaN" : String(Math.round(v * 1e8) / 1e8)) : String(v);
      }

      case "plot": {
        const value = numArg("series");
        let out = this.plots.get(e.id);
        if (!out) {
          out = {
            id: String(e.id),
            title: str("title") ?? `Plot ${this.plots.size + 1}`,
            color: "#2962ff",
            values: new Array(this.candles.length).fill(NaN),
            colors: [],
          };
          this.plots.set(e.id, out);
        }
        const color = str("color");
        if (color && out.colors.every((c) => c === undefined)) out.color = color;
        out.values[this.i] = value;
        out.colors[this.i] = color;
        return undefined;
      }

      case "plotshape":
      case "plotchar": {
        if (!truthy(arg("series"))) return undefined;
        const location = str("location") ?? "location.abovebar";
        const above = location === "location.abovebar" || location === "location.top" || location === "location.absolute";
        const style = e.name === "plotchar" ? "shape.circle" : (str("style") ?? "shape.xcross");
        this.markers.push({
          time: this.candles[this.i].time,
          position: above ? "aboveBar" : "belowBar",
          color: str("color") ?? "#2962ff",
          shape: SHAPE_MAP[style] ?? (above ? "arrowDown" : "arrowUp"),
          text: e.name === "plotchar" ? (str("char") ?? str("title")) : str("text"),
        });
        return undefined;
      }

      case "hline": {
        if (!this.hlines.has(e.id)) {
          this.hlines.set(e.id, { price: numArg("price"), title: str("title") ?? "", color: str("color") ?? "#787b86" });
        }
        return undefined;
      }

      case "strategy.entry": {
        const id = str("id") ?? "entry";
        const direction = str("direction") === "strategy.short" ? -1 : 1;
        const qty = arg("qty");
        this.options.hooks?.entry(id, direction, qty === undefined || isNa(qty) ? undefined : num(qty), str("comment"));
        return undefined;
      }
      case "strategy.close":
        this.options.hooks?.close(str("id") ?? null, str("comment"));
        return undefined;
      case "strategy.close_all":
        this.options.hooks?.close(null, str("comment"));
        return undefined;
      case "strategy.exit": {
        const opt = (name: string) => {
          const v = numArg(name);
          return Number.isNaN(v) ? undefined : v;
        };
        this.options.hooks?.exit({
          id: str("id") ?? "exit",
          from: str("from_entry") ?? null,
          stop: opt("stop"),
          limit: opt("limit"),
          profit: opt("profit"),
          loss: opt("loss"),
          comment: str("comment"),
        });
        return undefined;
      }
    }
    throw new PineRuntimeError(e.line, `${e.name}는 실행할 수 없는 함수예요.`);
  }
}
