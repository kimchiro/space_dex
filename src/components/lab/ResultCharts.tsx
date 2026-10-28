"use client";

import {
  AreaSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type DeepPartial,
  type IChartApi,
  type TimeChartOptions,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import styled from "styled-components";
import { toChartTime } from "@/components/chart/TradingChart";
import type { EquityPoint, Trade } from "@/lib/backtest/engine";
import { theme } from "@/styles/theme";

const BASE_OPTIONS: DeepPartial<TimeChartOptions> = {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: theme.colors.bg },
    textColor: theme.colors.textSub,
    fontFamily: "Pretendard, -apple-system, sans-serif",
    fontSize: 11,
    attributionLogo: true,
  },
  grid: { vertLines: { visible: false }, horzLines: { color: "#f2f4f6" } },
  rightPriceScale: { borderColor: theme.colors.border },
  timeScale: { borderColor: theme.colors.border },
};

function useChart(build: (chart: IChartApi) => void, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, BASE_OPTIONS);
    build(chart);
    chart.timeScale().fitContent();
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function EquityChart({ equity, buyHold, boundaryTime }: { equity: EquityPoint[]; buyHold: EquityPoint[]; boundaryTime: number }) {
  const ref = useChart(
    (chart) => {
      const strategy = chart.addSeries(AreaSeries, {
        lineColor: theme.colors.primary,
        topColor: "rgba(49, 130, 246, 0.25)",
        bottomColor: "rgba(49, 130, 246, 0.02)",
        lineWidth: 2,
        priceLineVisible: false,
        title: "전략",
      });
      strategy.setData(equity.map((p) => ({ time: toChartTime(p.time), value: p.equity })));
      const hold = chart.addSeries(LineSeries, {
        color: theme.colors.textDisabled,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        title: "보유만 했을 때",
      });
      hold.setData(buyHold.map((p) => ({ time: toChartTime(p.time), value: p.equity })));
      createSeriesMarkers(strategy, [{ time: toChartTime(boundaryTime), position: "aboveBar", color: "#7b5cff", shape: "arrowDown", text: "검증 구간 시작" }]);
    },
    [equity, buyHold, boundaryTime],
  );
  return <ChartBox ref={ref} style={{ height: 260 }} />;
}

function periodKey(time: number, unit: "day" | "week" | "month") {
  const d = new Date((time + 9 * 3600) * 1000);
  if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000 - 9 * 3600;
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000 - 9 * 3600;
  if (unit === "day") return day;
  return day - ((d.getUTCDay() + 6) % 7) * 86_400;
}

export function periodUnit(from: number, to: number): "day" | "week" | "month" {
  const days = (to - from) / 86_400;
  return days <= 45 ? "day" : days <= 400 ? "week" : "month";
}

export const PERIOD_LABEL = { day: "일별", week: "주별", month: "월별" } as const;

export function PeriodPnlChart({ trades, unit }: { trades: Trade[]; unit: "day" | "week" | "month" }) {
  const ref = useChart(
    (chart) => {
      const sums = new Map<number, number>();
      for (const t of trades) {
        const key = periodKey(t.exitTime, unit);
        sums.set(key, (sums.get(key) ?? 0) + t.pnl);
      }
      const series = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      series.setData(
        [...sums.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time: toChartTime(time), value, color: value >= 0 ? theme.colors.rise : theme.colors.fall })),
      );
    },
    [trades, unit],
  );
  return <ChartBox ref={ref} style={{ height: 200 }} />;
}

export function PnlDistribution({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  const values = trades.map((t) => t.pnlPct);
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const width = Math.max(0.5, Math.ceil(((max - min) / 14) * 2) / 2);
  const size = Math.max(1, Math.ceil((max - min) / width));
  const buckets = Array.from({ length: size }, (_, k) => ({ from: min + k * width, count: 0 }));
  for (const v of values) buckets[Math.min(size - 1, Math.floor((v - min) / width))].count++;
  const peak = Math.max(...buckets.map((b) => b.count));

  return (
    <Dist>
      {buckets.map((b) => (
        <div key={b.from} title={`${b.from.toFixed(1)}% ~ ${(b.from + width).toFixed(1)}%: ${b.count}회`}>
          <span className="count">{b.count || ""}</span>
          <i style={{ height: `${(b.count / peak) * 100}%`, background: b.from + width / 2 >= 0 ? theme.colors.rise : theme.colors.fall }} />
          <span className="label">{b.from.toFixed(width < 1 ? 1 : 0)}%</span>
        </div>
      ))}
    </Dist>
  );
}

const ChartBox = styled.div`
  position: relative;
  width: 100%;
`;

const Dist = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 200px;
  padding-top: 18px;

  div {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    min-width: 0;
  }

  i {
    width: 100%;
    min-height: 1px;
    border-radius: 4px 4px 0 0;
  }

  .count {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.textSub};
  }

  .label {
    margin-top: 4px;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
  }
`;
