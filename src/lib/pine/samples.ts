export type PineSample = { id: string; label: string; description: string; code: string };

export const MA_CROSS_STRATEGY = `//@version=5
strategy("SPACEDEX EMA 교차 전략", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.1)

fastLen = input.int(9, "빠른 EMA", minval=1)
slowLen = input.int(21, "느린 EMA", minval=1)
stopPct = input.float(2.0, "손절 %", step=0.1)
takePct = input.float(4.0, "익절 %", step=0.1)

fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
plot(fast, "빠른 EMA", color=color.orange)
plot(slow, "느린 EMA", color=color.blue)

longCond = ta.crossover(fast, slow)
exitCond = ta.crossunder(fast, slow)

if longCond
    strategy.entry("Long", strategy.long)

if strategy.position_size > 0
    strategy.exit("TP/SL", "Long", stop=strategy.position_avg_price * (1 - stopPct / 100), limit=strategy.position_avg_price * (1 + takePct / 100))

if exitCond
    strategy.close("Long", comment="데드크로스")

plotshape(longCond, "골든크로스", shape.triangleup, location.belowbar, color.green)
`;

const RSI_V4_INDICATOR = `//@version=4
study("RSI 과매수·과매도", overlay=false)
len = input(14, title="RSI 기간", type=input.integer)
src = input(close, title="소스")
r = rsi(src, len)
plot(r, title="RSI", color=color.purple)
hline(70, "과매수", color=color.red)
hline(30, "과매도", color=color.green)
plotshape(crossunder(r, 70), title="과매수 이탈", style=shape.triangledown, location=location.abovebar, color=color.red)
plotshape(crossover(r, 30), title="과매도 반등", style=shape.triangleup, location=location.belowbar, color=color.green)
`;

const UNSUPPORTED_EXAMPLE = `//@version=5
indicator("다중 시간봉 추세", overlay=true)

htf = input.string("240", "상위 시간봉")
ma = ta.sma(close, 50)
htfMa = request.security(syminfo.tickerid, htf, ta.sma(close, 50))

plot(ma, "MA 50", color=color.blue)
plot(htfMa, "상위 MA 50", color=color.red)
bgcolor(close > htfMa ? color.new(color.green, 90) : na)

for i = 0 to 9
    label.new(bar_index, high, "x")
`;

export const PINE_SAMPLES: PineSample[] = [
  { id: "ma-cross", label: "EMA 교차 전략 (v5)", description: "골든크로스 진입 · 손절/익절 · 데드크로스 청산", code: MA_CROSS_STRATEGY },
  { id: "rsi-v4", label: "RSI 지표 (v4 → v5 변환)", description: "v4 함수 이름과 input 타입을 v5로 자동 변환", code: RSI_V4_INDICATOR },
  { id: "unsupported", label: "지원하지 않는 코드 예시", description: "변환하지 못한 줄과 이유 표시", code: UNSUPPORTED_EXAMPLE },
];
