"use client";

import { useMemo } from "react";
import type { ChartMarker, PlotOverlay, PriceLineSpec } from "@/components/chart/TradingChart";
import { DEFAULT_SETTINGS, runBacktest, type BacktestSettings } from "@/lib/backtest/engine";
import type { SavedScript } from "@/lib/lab/stores";
import { intervalSeconds, type Candle, type IntervalKey } from "@/lib/market/candles";
import { analyzePine, type PineAnalysis } from "@/lib/pine/analyze";
import { PineRunner } from "@/lib/pine/runtime";
import { chartDataFromOutputs, tradeMarkers } from "./chartData";

const EMPTY = { overlays: [] as PlotOverlay[], markers: [] as ChartMarker[], priceLines: [] as PriceLineSpec[], error: null as string | null };

/** 스크립트 기본 설정(초기자본·수량·수수료)을 백테스트 설정에 반영한다. */
export function settingsFromScript(analysis: PineAnalysis | null, base: BacktestSettings = DEFAULT_SETTINGS): BacktestSettings {
  const d = analysis?.strategyDefaults ?? {};
  return {
    ...base,
    initialCapital: d.initialCapital ?? base.initialCapital,
    qtyPercent: d.qtyType === "percent_of_equity" && d.qtyValue ? d.qtyValue : base.qtyPercent,
    feePct: d.commissionPct ?? base.feePct,
  };
}

export function useAnalysis(code: string | undefined) {
  return useMemo(() => (code ? analyzePine(code) : null), [code]);
}

/** 저장한 지표·전략을 주어진 캔들에 실행해 차트에 얹을 데이터로 만든다. */
export function useScriptOverlay(script: SavedScript | null | undefined, candles: Candle[], symbol: string, interval: IntervalKey) {
  const analysis = useAnalysis(script?.code);
  return useMemo(() => {
    if (!script || !analysis || candles.length === 0) return EMPTY;
    if (!analysis.program) return { ...EMPTY, error: "코드에 오류가 있어 표시할 수 없어요." };
    try {
      if (analysis.kind === "strategy") {
        const result = runBacktest({
          analysis,
          candles,
          inputs: script.inputs,
          settings: settingsFromScript(analysis),
          intervalSeconds: intervalSeconds(interval),
          symbol,
          interval,
        });
        const data = chartDataFromOutputs(result.outputs, analysis.overlay, candles.length);
        return { ...data, markers: [...data.markers, ...tradeMarkers(result.trades)], error: null };
      }
      const outputs = new PineRunner(analysis, candles, { inputs: script.inputs, symbol, interval }).runAll();
      return { ...chartDataFromOutputs(outputs, analysis.overlay, candles.length), error: null };
    } catch (error) {
      return { ...EMPTY, error: error instanceof Error ? error.message : String(error) };
    }
  }, [script, analysis, candles, symbol, interval]);
}
