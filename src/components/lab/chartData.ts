import type { ChartMarker, PlotOverlay, PriceLineSpec } from "@/components/chart/TradingChart";
import type { Trade } from "@/lib/backtest/engine";
import type { PineOutputs } from "@/lib/pine/runtime";
import { theme } from "@/styles/theme";

/** Pine 실행 결과를 차트 선·마커·수평선으로 바꾼다. overlay=false 지표는 아래 별도 패널에 그린다. */
export function chartDataFromOutputs(outputs: PineOutputs, overlay: boolean, length: number) {
  const pane = overlay ? "main" : "sub";
  const overlays: PlotOverlay[] = outputs.plots.map((p) => ({
    id: p.id,
    title: p.title,
    color: p.color,
    values: p.values,
    colors: p.colors.some((c, i) => c && c !== p.colors[i - 1] && i > 0) ? p.colors : undefined,
    pane,
  }));
  const priceLines: PriceLineSpec[] = [];
  for (const h of outputs.hlines) {
    if (overlay) priceLines.push({ price: h.price, color: h.color, title: h.title, dashed: true });
    else overlays.push({ id: `hline-${h.price}-${h.title}`, title: h.title, color: h.color, values: new Array(length).fill(h.price), pane: "sub", lineWidth: 1 });
  }
  return { overlays, markers: outputs.markers, priceLines };
}

export function tradeMarkers(trades: Trade[], selected?: number): ChartMarker[] {
  return trades.flatMap((t) => {
    const highlight = t.no === selected;
    const long = t.direction === 1;
    return [
      {
        time: t.entryTime,
        position: long ? "belowBar" : "aboveBar",
        color: highlight ? "#191f28" : long ? theme.colors.rise : theme.colors.fall,
        shape: long ? "arrowUp" : "arrowDown",
        text: highlight ? `#${t.no} 진입` : long ? "매수" : "매도",
      },
      {
        time: t.exitTime,
        position: long ? "aboveBar" : "belowBar",
        color: highlight ? "#191f28" : t.pnl >= 0 ? "#00a36c" : "#8b95a1",
        shape: "circle",
        text: `${highlight ? `#${t.no} ` : ""}${t.exitReason} ${t.pnl >= 0 ? "+" : ""}${t.pnlPct.toFixed(1)}%`,
      },
    ] satisfies ChartMarker[];
  });
}
