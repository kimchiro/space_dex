"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import styled from "styled-components";
import { bollinger, rsi, sma } from "@/lib/indicators";
import type { Candle } from "@/lib/market/candles";
import { theme } from "@/styles/theme";
import { DrawingLayer, type Drawing, type DrawingPoint, type DrawingTool } from "./drawingLayer";

/** 차트 시간축을 한국 시간으로 보이게 하려고 표시용 시각에만 9시간을 더한다. */
const KST_OFFSET = 9 * 3600;
export const toChartTime = (time: number) => (time + KST_OFFSET) as UTCTimestamp;
const fromChartTime = (time: Time) => (time as number) - KST_OFFSET;

export type IndicatorConfig = { volume: boolean; ma: boolean; bb: boolean; rsi: boolean };
export const DEFAULT_INDICATORS: IndicatorConfig = { volume: true, ma: true, bb: false, rsi: false };

export type PlotOverlay = {
  id: string;
  title: string;
  color: string;
  /** candles와 같은 길이. 값이 없으면 NaN */
  values: number[];
  colors?: (string | undefined)[];
  pane: "main" | "sub";
  lineWidth?: number;
};

export type ChartMarker = {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  text?: string;
};

export type PriceLineSpec = { price: number; color: string; title: string; dashed?: boolean };

export type ChartHandle = {
  focusRange: (from: number, to: number) => void;
  screenshot: () => string | null;
};

type Props = {
  candles: Candle[];
  indicators?: IndicatorConfig;
  overlays?: PlotOverlay[];
  markers?: ChartMarker[];
  priceLines?: PriceLineSpec[];
  tool?: DrawingTool;
  drawings?: Drawing[];
  onDrawingsChange?: (drawings: Drawing[]) => void;
  onToolDone?: () => void;
  /** 바뀌면 최근 봉 위주로 화면을 다시 맞춘다. */
  viewKey?: string;
  height?: number;
  ref?: Ref<ChartHandle>;
};

const MA_LINES = [
  { length: 20, color: "#ff9500" },
  { length: 60, color: "#7b5cff" },
];

type Managed = { series: ISeriesApi<"Line" | "Histogram">; key: string };

const NO_OVERLAYS: PlotOverlay[] = [];
const NO_MARKERS: ChartMarker[] = [];
const NO_PRICE_LINES: PriceLineSpec[] = [];
const NO_DRAWINGS: Drawing[] = [];

export default function TradingChart({
  candles,
  indicators = DEFAULT_INDICATORS,
  overlays = NO_OVERLAYS,
  markers = NO_MARKERS,
  priceLines = NO_PRICE_LINES,
  tool = "none",
  drawings = NO_DRAWINGS,
  onDrawingsChange,
  onToolDone,
  viewKey,
  height = 420,
  ref,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const layerRef = useRef<DrawingLayer | null>(null);
  const managedRef = useRef<{ signature: string; items: Managed[] }>({ signature: "", items: [] });
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastViewKey = useRef<string | undefined>(undefined);

  const interaction = useRef({ tool, drawings, onDrawingsChange, onToolDone, pending: null as DrawingPoint | null });
  useEffect(() => {
    const pending = interaction.current.tool === tool ? interaction.current.pending : null;
    interaction.current = { tool, drawings, onDrawingsChange, onToolDone, pending };
    layerRef.current?.setDrawings(drawings, null);
  }, [tool, drawings, onDrawingsChange, onToolDone]);

  useImperativeHandle(ref, () => ({
    focusRange: (from, to) => {
      chartRef.current?.timeScale().setVisibleRange({ from: toChartTime(from), to: toChartTime(to) });
    },
    screenshot: () => chartRef.current?.takeScreenshot().toDataURL("image/png") ?? null,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: theme.colors.bg },
        textColor: theme.colors.textSub,
        fontFamily: "Pretendard, -apple-system, sans-serif",
        fontSize: 11,
        attributionLogo: true,
        panes: { separatorColor: theme.colors.border },
      },
      grid: {
        vertLines: { color: "#f2f4f6" },
        horzLines: { color: "#f2f4f6" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: theme.colors.border },
      timeScale: { borderColor: theme.colors.border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: theme.colors.rise,
      downColor: theme.colors.fall,
      wickUpColor: theme.colors.rise,
      wickDownColor: theme.colors.fall,
      borderVisible: false,
    });
    const layer = new DrawingLayer((t) => t + KST_OFFSET);
    candle.attachPrimitive(layer);

    chartRef.current = chart;
    candleRef.current = candle;
    markersRef.current = createSeriesMarkers(candle, []);
    layerRef.current = layer;

    const pointFrom = (param: MouseEventParams<Time>): DrawingPoint | null => {
      if (param.time === undefined || !param.point || (param.paneIndex ?? 0) !== 0) return null;
      const price = candle.coordinateToPrice(param.point.y);
      return price === null ? null : { time: fromChartTime(param.time), price };
    };

    const onClick = (param: MouseEventParams<Time>) => {
      const state = interaction.current;
      if (state.tool === "none") return;
      const point = pointFrom(param);
      if (!point) return;
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

      if (state.tool === "hline") {
        state.onDrawingsChange?.([...state.drawings, { id, kind: "hline", price: point.price }]);
        state.onToolDone?.();
        return;
      }
      if (!state.pending) {
        state.pending = point;
        return;
      }
      state.onDrawingsChange?.([...state.drawings, { id, kind: state.tool, a: state.pending, b: point }]);
      state.pending = null;
      state.onToolDone?.();
    };

    const onMove = (param: MouseEventParams<Time>) => {
      const state = interaction.current;
      if (state.pending && (state.tool === "trend" || state.tool === "fib")) {
        const point = pointFrom(param);
        layer.setDrawings(state.drawings, point ? { id: "preview", kind: state.tool, a: state.pending, b: point } : null);
      }

      const legend = legendRef.current;
      if (!legend) return;
      const bar = param.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined;
      legend.textContent = bar
        ? `시 ${fmt(bar.open)}  고 ${fmt(bar.high)}  저 ${fmt(bar.low)}  종 ${fmt(bar.close)}`
        : "";
    };

    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      markersRef.current = null;
      layerRef.current = null;
      managedRef.current = { signature: "", items: [] };
      priceLinesRef.current = [];
      lastViewKey.current = undefined;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    candle.setData(
      candles.map((c) => ({ time: toChartTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => toChartTime(c.time));
    const lines: { key: string; pane: number; color: string; values: number[]; colors?: (string | undefined)[]; width?: number; title?: string }[] = [];
    let nextPane = 1;

    if (indicators.ma) {
      for (const { length, color } of MA_LINES) {
        lines.push({ key: `ma${length}`, pane: 0, color, values: sma(closes, length), title: `MA${length}` });
      }
    }
    if (indicators.bb) {
      const bb = bollinger(closes, 20, 2);
      lines.push({ key: "bbU", pane: 0, color: "#00b8d9", values: bb.upper });
      lines.push({ key: "bbM", pane: 0, color: "#00b8d9", values: bb.basis });
      lines.push({ key: "bbL", pane: 0, color: "#00b8d9", values: bb.lower });
    }
    if (indicators.rsi) {
      lines.push({ key: "rsi", pane: nextPane++, color: "#7b5cff", values: rsi(closes, 14), title: "RSI 14" });
    }
    const subPane = overlays.some((o) => o.pane === "sub") ? nextPane++ : 0;
    for (const o of overlays) {
      lines.push({
        key: `ov:${o.id}`,
        pane: o.pane === "sub" ? subPane : 0,
        color: o.color,
        values: o.values,
        colors: o.colors,
        width: o.lineWidth,
        title: o.title,
      });
    }

    const signature = [indicators.volume ? "vol" : "", ...lines.map((l) => `${l.key}@${l.pane}`)].join("|");
    const managed = managedRef.current;
    if (managed.signature !== signature) {
      managed.items.forEach(({ series }) => chart.removeSeries(series));
      while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1);
      managed.items = [];

      if (indicators.volume) {
        const volume = chart.addSeries(HistogramSeries, {
          priceScaleId: "volume",
          priceFormat: { type: "volume" },
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        managed.items.push({ key: "vol", series: volume });
      }
      for (const line of lines) {
        const series = chart.addSeries(
          LineSeries,
          {
            color: line.color,
            lineWidth: (line.width ?? 1.5) as 1,
            priceLineVisible: false,
            lastValueVisible: line.pane !== 0,
            crosshairMarkerVisible: false,
            title: line.pane !== 0 ? line.title : undefined,
          },
          line.pane,
        );
        if (line.key === "rsi") {
          series.createPriceLine({ price: 70, color: theme.colors.rise, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
          series.createPriceLine({ price: 30, color: theme.colors.fall, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
        }
        managed.items.push({ key: line.key, series });
      }
      chart.panes().forEach((pane, i) => pane.setStretchFactor(i === 0 ? 1 : 0.32));
      managed.signature = signature;
    }

    for (const { key, series } of managed.items) {
      if (key === "vol") {
        (series as ISeriesApi<"Histogram">).setData(
          candles.map((c) => ({
            time: toChartTime(c.time),
            value: c.volume,
            color: c.close >= c.open ? "rgba(240, 68, 82, 0.35)" : "rgba(49, 130, 246, 0.35)",
          })),
        );
        continue;
      }
      const line = lines.find((l) => l.key === key);
      if (!line) continue;
      (series as ISeriesApi<"Line">).setData(
        line.values.map((value, i) =>
          Number.isFinite(value) ? { time: times[i], value, ...(line.colors?.[i] ? { color: line.colors[i] } : {}) } : { time: times[i] },
        ),
      );
    }

    if (viewKey !== lastViewKey.current && candles.length > 0) {
      lastViewKey.current = viewKey;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 150), to: candles.length + 4 });
    }
  }, [candles, indicators, overlays, viewKey]);

  useEffect(() => {
    markersRef.current?.setMarkers(
      markers
        .slice()
        .sort((a, b) => a.time - b.time)
        .map(
          (m): SeriesMarker<Time> => ({
            time: toChartTime(m.time),
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text,
          }),
        ),
    );
  }, [markers]);

  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    priceLinesRef.current.forEach((line) => candle.removePriceLine(line));
    priceLinesRef.current = priceLines.map((p) =>
      candle.createPriceLine({
        price: p.price,
        color: p.color,
        title: p.title,
        lineWidth: 1,
        lineStyle: p.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
      }),
    );
  }, [priceLines]);

  return (
    <Frame style={{ height }} $drawing={tool !== "none"}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <Legend ref={legendRef} />
    </Frame>
  );
}

function fmt(value: number) {
  return value >= 1 ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value.toPrecision(4);
}

const Frame = styled.div<{ $drawing: boolean }>`
  position: relative;
  width: 100%;
  cursor: ${({ $drawing }) => ($drawing ? "crosshair" : "default")};
`;

const Legend = styled.div`
  position: absolute;
  top: 6px;
  left: 8px;
  z-index: 2;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textSub};
  pointer-events: none;
  white-space: nowrap;
`;
