import type { Diagnostic, Expr, Program, Stmt } from "./ast";
import {
  ASSUMED_VARIABLES,
  CONSTANT_PREFIXES,
  COLORS,
  FUNCTIONS,
  SERIES_VARIABLES,
  STRATEGY_CONSTANTS,
  STRATEGY_VARIABLES,
  supportOf,
  type Support,
} from "./builtins";
import { convertToV5, detectVersion, type Change } from "./convert";
import { lex } from "./lexer";
import { parse } from "./parser";

export type InputType = "int" | "float" | "bool" | "source" | "string";
export type InputValue = number | boolean | string;

export type InputSpec = {
  key: string;
  title: string;
  type: InputType;
  defval: InputValue;
  minval?: number;
  maxval?: number;
  step?: number;
  line: number;
};

export type FunctionUsage = { name: string; count: number; support: Support; note?: string; lines: number[] };

export type StrategyDefaults = {
  initialCapital?: number;
  qtyType?: "percent_of_equity" | "fixed" | "cash";
  qtyValue?: number;
  pyramiding?: number;
  commissionPct?: number;
};

export type PineAnalysis = {
  version: number | null;
  kind: "indicator" | "strategy" | null;
  title: string;
  overlay: boolean;
  code: string;
  changes: Change[];
  diagnostics: Diagnostic[];
  functions: FunctionUsage[];
  inputs: InputSpec[];
  strategyDefaults: StrategyDefaults;
  program: Program | null;
  hash: string;
};

export function hashText(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 리터럴·상수만으로 이뤄진 인자 값. 계산이 필요한 값이면 undefined. */
function constValue(e: Expr | undefined): InputValue | undefined {
  if (!e) return undefined;
  switch (e.k) {
    case "num":
      return e.v;
    case "str":
      return e.v;
    case "bool":
      return e.v;
    case "id":
      return e.name;
    case "un": {
      const v = constValue(e.e);
      return e.op === "-" && typeof v === "number" ? -v : v;
    }
    default:
      return undefined;
  }
}

const argOf = (call: Extract<Expr, { k: "call" }>, name: string) => {
  const params = FUNCTIONS[call.name]?.params ?? [];
  const index = params.indexOf(name);
  return call.named[name] ?? (index >= 0 ? call.args[index] : undefined);
};

function walkExpr(e: Expr, visit: (e: Expr) => void) {
  visit(e);
  switch (e.k) {
    case "hist":
      walkExpr(e.e, visit);
      walkExpr(e.offset, visit);
      break;
    case "un":
      walkExpr(e.e, visit);
      break;
    case "bin":
      walkExpr(e.l, visit);
      walkExpr(e.r, visit);
      break;
    case "tern":
      walkExpr(e.c, visit);
      walkExpr(e.a, visit);
      walkExpr(e.b, visit);
      break;
    case "call":
      e.args.forEach((a) => walkExpr(a, visit));
      Object.values(e.named).forEach((a) => walkExpr(a, visit));
      break;
  }
}

function walkStmts(stmts: Stmt[], visit: (s: Stmt) => void) {
  for (const s of stmts) {
    visit(s);
    if (s.t === "if") {
      walkStmts(s.then, visit);
      walkStmts(s.else, visit);
    }
  }
}

const isKnownConstant = (name: string) =>
  name in COLORS || STRATEGY_CONSTANTS.includes(name) || CONSTANT_PREFIXES.some((p) => name.startsWith(p));

/** 코드 붙여넣기 → 버전 확인 → 변환 → 지원 여부·오류 줄 표시까지 한 번에 수행한다. */
export function analyzePine(source: string): PineAnalysis {
  const diagnostics: Diagnostic[] = [];
  const version = detectVersion(source);

  if (version === null) {
    diagnostics.push({ line: 1, severity: "error", message: "첫 줄에 //@version=5 주석이 필요해요. 버전 표시가 없으면 v1 코드로 간주돼 변환할 수 없어요." });
  } else if (version < 4) {
    diagnostics.push({ line: 1, severity: "error", message: `Pine v${version}는 지원하지 않아요. TradingView 편집기에서 v4 이상으로 변환한 뒤 가져와 주세요.` });
  } else if (version > 6) {
    diagnostics.push({ line: 1, severity: "warning", message: `Pine v${version}는 확인하지 않은 버전이에요. v5 문법 기준으로 해석해요.` });
  }

  const { code, changes } = convertToV5(source);
  const { lines, errors } = lex(code);
  errors.forEach((e) => diagnostics.push({ line: e.line, severity: "error", message: e.message }));
  const { program, diagnostics: parseDiagnostics } = parse(lines);
  diagnostics.push(...parseDiagnostics);

  let kind: PineAnalysis["kind"] = null;
  let title = "이름 없는 스크립트";
  let overlay = false;
  const strategyDefaults: StrategyDefaults = {};
  const usage = new Map<string, FunctionUsage>();
  const inputs: InputSpec[] = [];
  const assigned = new Set<string>();

  walkStmts(program, (s) => {
    if (s.t === "assign") assigned.add(s.name);
    if (s.t === "tuple") s.names.forEach((n) => assigned.add(n));
  });

  const checkCall = (call: Extract<Expr, { k: "call" }>) => {
    const { support, note } = supportOf(call.name);
    const entry = usage.get(call.name) ?? { name: call.name, count: 0, support, note, lines: [] };
    entry.count++;
    if (!entry.lines.includes(call.line)) entry.lines.push(call.line);
    usage.set(call.name, entry);

    if (support === "unsupported") {
      diagnostics.push({ line: call.line, severity: "error", message: `${call.name}: ${note}` });
      return;
    }

    if (call.name === "strategy.entry" && (argOf(call, "limit") || argOf(call, "stop"))) {
      diagnostics.push({ line: call.line, severity: "error", message: "strategy.entry의 limit·stop 진입은 아직 지원하지 않아요. 시장가 진입으로 바꾸거나 다음 단계를 기다려 주세요." });
    }
    if (call.name === "strategy.exit" && ["trail_price", "trail_points", "trail_offset"].some((n) => argOf(call, n))) {
      diagnostics.push({ line: call.line, severity: "error", message: "strategy.exit의 트레일링 스탑은 아직 지원하지 않아요." });
    }
    if (call.name === "strategy.exit" && ["profit", "loss"].some((n) => argOf(call, n))) {
      diagnostics.push({ line: call.line, severity: "warning", message: "profit·loss는 틱 단위예요. 최소 호가 단위를 0.01로 가정해 가격으로 바꿔요." });
    }
    if (call.name === "strategy.close" && (argOf(call, "qty") || argOf(call, "qty_percent"))) {
      diagnostics.push({ line: call.line, severity: "warning", message: "부분 청산은 아직 지원하지 않아 전량 청산으로 처리해요." });
    }
    if (call.name === "plot" && argOf(call, "style")) {
      diagnostics.push({ line: call.line, severity: "info", message: "plot의 style은 실선으로 표시해요." });
    }

    if (call.name === "indicator" || call.name === "strategy") {
      if (kind) diagnostics.push({ line: call.line, severity: "error", message: "indicator()·strategy() 선언은 한 번만 쓸 수 있어요." });
      kind = call.name;
      const t = constValue(argOf(call, "title"));
      if (typeof t === "string") title = t;
      overlay = constValue(argOf(call, "overlay")) === true;
      if (call.name === "strategy") {
        const num = (name: string) => {
          const v = constValue(call.named[name]);
          return typeof v === "number" ? v : undefined;
        };
        strategyDefaults.initialCapital = num("initial_capital");
        strategyDefaults.qtyValue = num("default_qty_value");
        strategyDefaults.pyramiding = num("pyramiding");
        strategyDefaults.commissionPct = constValue(call.named.commission_type) === "strategy.commission.percent" || !call.named.commission_type ? num("commission_value") : undefined;
        const qtyType = constValue(call.named.default_qty_type);
        if (typeof qtyType === "string") strategyDefaults.qtyType = qtyType.replace("strategy.", "") as StrategyDefaults["qtyType"];
      }
    }

    if (call.name === "input" || call.name.startsWith("input.")) {
      const defExpr = argOf(call, "defval");
      const defval = constValue(defExpr);
      const titleValue = constValue(argOf(call, "title"));
      const num = (name: string) => {
        const v = constValue(argOf(call, name));
        return typeof v === "number" ? v : undefined;
      };
      let type: InputType;
      if (call.name === "input.int") type = "int";
      else if (call.name === "input.float") type = "float";
      else if (call.name === "input.bool") type = "bool";
      else if (call.name === "input.string") type = "string";
      else if (call.name === "input.source" || (defExpr?.k === "id" && SERIES_VARIABLES.includes(defExpr.name))) type = "source";
      else if (typeof defval === "boolean") type = "bool";
      else if (typeof defval === "string") type = "string";
      else type = typeof defval === "number" && Number.isInteger(defval) ? "int" : "float";

      if (defval === undefined) {
        diagnostics.push({ line: call.line, severity: "error", message: "input의 기본값은 숫자·문자·참거짓·가격 계열(close 등)이어야 해요." });
        return;
      }
      inputs.push({
        key: `in${call.id}`,
        title: typeof titleValue === "string" ? titleValue : `입력 ${inputs.length + 1}`,
        type,
        defval,
        minval: num("minval"),
        maxval: num("maxval"),
        step: num("step"),
        line: call.line,
      });
      if (call.named.options) diagnostics.push({ line: call.line, severity: "info", message: "options 목록은 아직 선택 상자로 보여주지 않고 직접 입력으로 받아요." });
    }
  };

  const checkId = (e: Extract<Expr, { k: "id" }>) => {
    const name = e.name;
    if (assigned.has(name) || SERIES_VARIABLES.includes(name) || STRATEGY_VARIABLES.includes(name) || isKnownConstant(name)) return;
    if (ASSUMED_VARIABLES[name]) {
      diagnostics.push({ line: e.line, severity: "warning", message: `${name}: ${ASSUMED_VARIABLES[name]}` });
      return;
    }
    if (name.startsWith("syminfo.") || name.startsWith("timeframe.") || name.startsWith("barstate.") || name.startsWith("session.")) {
      diagnostics.push({ line: e.line, severity: "error", message: `${name}: 아직 지원하지 않는 내장 변수예요.` });
      return;
    }
    diagnostics.push({ line: e.line, severity: "error", message: `'${name}'가 정의되지 않았어요.` });
  };

  walkStmts(program, (s) => {
    const exprs = s.t === "if" ? [s.cond] : [s.e];
    exprs.forEach((root) =>
      walkExpr(root, (e) => {
        if (e.k === "call") checkCall(e);
        if (e.k === "id") checkId(e);
      }),
    );
    if (s.t === "tuple") {
      const callName = s.e.k === "call" ? s.e.name : "";
      if (callName !== "ta.bb" && callName !== "ta.macd") {
        diagnostics.push({ line: s.line, severity: "error", message: "[a, b] = ... 형태는 ta.bb, ta.macd에만 쓸 수 있어요." });
      }
    }
  });

  if (!kind && diagnostics.every((d) => d.severity !== "error" || d.line !== 1)) {
    diagnostics.push({ line: 1, severity: "error", message: "indicator(...) 또는 strategy(...) 선언이 필요해요." });
  }

  const hasError = diagnostics.some((d) => d.severity === "error");
  const order = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => a.line - b.line || order[a.severity] - order[b.severity]);

  return {
    version,
    kind,
    title,
    overlay,
    code,
    changes,
    diagnostics,
    functions: [...usage.values()].sort((a, b) => a.lines[0] - b.lines[0]),
    inputs,
    strategyDefaults,
    program: hasError ? null : program,
    hash: hashText(code),
  };
}
