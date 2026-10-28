export type Support = "supported" | "partial" | "unsupported";

export type FunctionSpec = { params: string[]; support: Support; note?: string };

const ok = (params: string[], note?: string): FunctionSpec => ({ params, support: "supported", note });
const partial = (params: string[], note: string): FunctionSpec => ({ params, support: "partial", note });

const INPUT_PARAMS = ["defval", "title", "minval", "maxval", "step", "tooltip", "inline", "group", "confirm"];

/** 1단계 지원 함수 목록. 순서 인자 이름은 Pine v5 레퍼런스를 따른다. */
export const FUNCTIONS: Record<string, FunctionSpec> = {
  indicator: ok(["title", "shorttitle", "overlay"]),
  strategy: partial(
    ["title", "shorttitle", "overlay"],
    "initial_capital·default_qty_*·pyramiding·commission_value만 읽고, 나머지 설정은 백테스트 화면 값을 써요.",
  ),

  "ta.sma": ok(["source", "length"]),
  "ta.ema": ok(["source", "length"]),
  "ta.rma": ok(["source", "length"]),
  "ta.wma": ok(["source", "length"]),
  "ta.rsi": ok(["source", "length"]),
  "ta.stdev": ok(["source", "length"]),
  "ta.highest": ok(["source", "length"]),
  "ta.lowest": ok(["source", "length"]),
  "ta.change": ok(["source", "length"]),
  "ta.atr": ok(["length"]),
  "ta.crossover": ok(["source1", "source2"]),
  "ta.crossunder": ok(["source1", "source2"]),
  "ta.cross": ok(["source1", "source2"]),
  "ta.bb": ok(["series", "length", "mult"]),
  "ta.macd": ok(["source", "fastlen", "slowlen", "siglen"]),

  "math.abs": ok(["number"]),
  "math.max": ok([]),
  "math.min": ok([]),
  "math.round": ok(["number", "precision"]),
  "math.floor": ok(["number"]),
  "math.ceil": ok(["number"]),
  "math.sqrt": ok(["number"]),
  "math.pow": ok(["base", "exponent"]),
  "math.log": ok(["number"]),
  nz: ok(["source", "replacement"]),
  na: ok(["x"]),

  input: ok(INPUT_PARAMS),
  "input.int": ok([...INPUT_PARAMS, "options"]),
  "input.float": ok([...INPUT_PARAMS, "options"]),
  "input.bool": ok(["defval", "title", "tooltip", "inline", "group", "confirm"]),
  "input.source": ok(["defval", "title", "tooltip", "inline", "group"]),
  "input.string": ok(["defval", "title", "options", "tooltip", "inline", "group", "confirm"]),

  "color.new": ok(["color", "transp"]),
  "color.rgb": ok(["red", "green", "blue", "transp"]),
  "str.tostring": partial(["value", "format"], "format 인자는 무시하고 기본 숫자 표기를 써요."),

  plot: partial(["series", "title", "color", "linewidth", "style"], "선 형태(style)는 모두 실선으로 표시해요."),
  plotshape: partial(
    ["series", "title", "style", "location", "color", "offset", "text"],
    "모양은 화살표·원·사각형 중 가까운 것으로 표시하고 offset은 무시해요.",
  ),
  plotchar: partial(["series", "title", "char", "location", "color"], "문자 대신 원 마커와 텍스트로 표시해요."),
  hline: ok(["price", "title", "color", "linestyle", "linewidth"]),

  "strategy.entry": partial(
    ["id", "direction", "qty", "limit", "stop", "oca_name", "oca_type", "comment"],
    "시장가 진입만 지원해요. limit·stop 진입은 다음 단계에서 지원해요.",
  ),
  "strategy.close": partial(["id", "comment", "qty", "qty_percent"], "부분 청산(qty·qty_percent)은 아직 전량 청산으로 처리해요."),
  "strategy.close_all": ok(["comment"]),
  "strategy.exit": partial(
    ["id", "from_entry", "qty", "qty_percent", "profit", "limit", "loss", "stop", "trail_price", "trail_points", "trail_offset", "oca_name", "comment"],
    "stop·limit 가격과 profit·loss 틱을 지원해요. 트레일링 스탑은 다음 단계에서 지원해요.",
  ),
};

/** 함수 이름 접두어별 미지원 사유. 조용히 무시하지 않고 해당 줄에 표시한다. */
export const UNSUPPORTED: { match: (name: string) => boolean; note: string }[] = [
  { match: (n) => n === "request.security" || n === "security", note: "다른 시간봉·종목 참조는 2단계에서 지원해요. 지금은 같은 차트 시간봉만 계산해요." },
  { match: (n) => n.startsWith("request."), note: "외부 데이터 요청(request.*)은 지원하지 않아요." },
  { match: (n) => /^(label|line|box|table|polyline|linefill)\./.test(n), note: "그리기 객체(label·line·box·table)는 아직 차트에 표시하지 않아요." },
  { match: (n) => ["bgcolor", "fill", "barcolor", "plotcandle", "plotbar", "plotarrow"].includes(n), note: "배경색·채우기·봉 색 변경은 아직 표시하지 않아요." },
  { match: (n) => n === "alert" || n === "alertcondition", note: "알림은 서버 자동매매 연결 단계에서 지원해요." },
  { match: (n) => /^(array|map|matrix)\./.test(n), note: "배열·맵·행렬 타입은 아직 지원하지 않아요." },
  { match: (n) => n === "strategy.order", note: "strategy.order는 지원하지 않아요. strategy.entry로 바꿔 주세요." },
  { match: (n) => n.startsWith("strategy.risk."), note: "strategy.risk.* 위험 관리 함수는 아직 지원하지 않아요. 백테스트 설정의 손실 한도를 사용해 주세요." },
  { match: (n) => n === "timeframe.change" || n === "time_close" || n === "timenow", note: "시간 관련 함수는 아직 지원하지 않아요." },
];

export const COLORS: Record<string, string> = {
  "color.red": "#f23645",
  "color.green": "#089981",
  "color.blue": "#2962ff",
  "color.orange": "#ff9800",
  "color.yellow": "#fdd835",
  "color.purple": "#9c27b0",
  "color.fuchsia": "#e040fb",
  "color.lime": "#00e676",
  "color.aqua": "#00bcd4",
  "color.teal": "#00897b",
  "color.navy": "#311b92",
  "color.maroon": "#880e4f",
  "color.olive": "#808000",
  "color.silver": "#b2b5be",
  "color.gray": "#787b86",
  "color.white": "#ffffff",
  "color.black": "#363a45",
};

/** 이름만으로 값을 가지는 내장 상수. 의미는 런타임에서 문자열로 다룬다. */
export const CONSTANT_PREFIXES = ["color.", "location.", "shape.", "size.", "plot.style_", "hline.style_", "display.", "format.", "extend.", "xloc.", "yloc.", "position.", "text.", "font."];

export const SERIES_VARIABLES = ["open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hlcc4", "bar_index", "time"];

export const STRATEGY_VARIABLES = [
  "strategy.position_size",
  "strategy.position_avg_price",
  "strategy.equity",
  "strategy.netprofit",
  "strategy.opentrades",
  "strategy.closedtrades",
  "strategy.initial_capital",
];

export const STRATEGY_CONSTANTS = [
  "strategy.long",
  "strategy.short",
  "strategy.percent_of_equity",
  "strategy.fixed",
  "strategy.cash",
  "strategy.commission.percent",
  "strategy.commission.cash_per_order",
  "strategy.commission.cash_per_contract",
];

/** 실제 값이 없어 가정값을 쓰는 변수. 사용하면 경고로 알린다. */
export const ASSUMED_VARIABLES: Record<string, string> = {
  "syminfo.mintick": "최소 호가 단위는 0.01로 가정해요.",
  "syminfo.ticker": "티커는 차트 종목 심볼을 써요.",
  "timeframe.period": "현재 차트 시간봉 문자열을 써요.",
};

/** v4 이하 → v5 함수 이름 변경표 */
export const V4_RENAMES: Record<string, string> = {
  sma: "ta.sma",
  ema: "ta.ema",
  rma: "ta.rma",
  wma: "ta.wma",
  rsi: "ta.rsi",
  stdev: "ta.stdev",
  highest: "ta.highest",
  lowest: "ta.lowest",
  change: "ta.change",
  atr: "ta.atr",
  crossover: "ta.crossover",
  crossunder: "ta.crossunder",
  cross: "ta.cross",
  bb: "ta.bb",
  macd: "ta.macd",
  abs: "math.abs",
  max: "math.max",
  min: "math.min",
  round: "math.round",
  floor: "math.floor",
  ceil: "math.ceil",
  sqrt: "math.sqrt",
  pow: "math.pow",
  log: "math.log",
  study: "indicator",
  security: "request.security",
  tostring: "str.tostring",
};

export const V4_INPUT_TYPES: Record<string, string> = {
  "input.integer": "input.int",
  "input.float": "input.float",
  "input.bool": "input.bool",
  "input.source": "input.source",
  "input.string": "input.string",
};

export function supportOf(name: string): { support: Support; note?: string; known: boolean } {
  const spec = FUNCTIONS[name];
  if (spec) return { support: spec.support, note: spec.note, known: true };
  const unsupported = UNSUPPORTED.find((u) => u.match(name));
  if (unsupported) return { support: "unsupported", note: unsupported.note, known: true };
  return { support: "unsupported", note: "SPACEDEX 변환기가 아직 모르는 함수예요.", known: false };
}
