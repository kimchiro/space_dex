import type { Candle } from "@/lib/market/candles";
import type { PlotOutput } from "@/lib/pine/runtime";

export type ColumnComparison = { column: string; plot: string | null; matched: number; maxAbsDiff: number; maxRelDiffPct: number; ok: boolean };

const TOLERANCE_PCT = 0.01;

function parseTime(raw: string) {
  const value = raw.trim();
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    return n > 1e11 ? Math.floor(n / 1000) : n;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

/**
 * TradingView "차트 데이터 내보내기" CSV와 변환본 지표 값을 같은 봉 시각끼리 비교한다.
 * 열 이름이 plot 제목과 같으면 짝을 짓는다.
 */
export function compareWithCsv(csv: string, candles: Candle[], plots: PlotOutput[]): { rows: number; columns: ColumnComparison[]; error?: string } {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: 0, columns: [], error: "머리글과 값이 있는 CSV를 붙여 넣어 주세요." };
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const timeIndex = header.findIndex((h) => /^(time|date|datetime|시간)$/i.test(h));
  if (timeIndex < 0) return { rows: 0, columns: [], error: "time 열을 찾지 못했어요." };

  const indexByTime = new Map(candles.map((c, i) => [c.time, i]));
  const rows = lines.slice(1).map((l) => l.split(",").map((v) => v.trim().replace(/^"|"$/g, "")));
  const skip = new Set(["open", "high", "low", "close", "volume"]);

  const columns = header
    .map((name, col) => ({ name, col }))
    .filter(({ name, col }) => col !== timeIndex && !skip.has(name.toLowerCase()))
    .map(({ name, col }): ColumnComparison => {
      const plot = plots.find((p) => p.title.toLowerCase() === name.toLowerCase()) ?? null;
      let matched = 0;
      let maxAbsDiff = 0;
      let maxRelDiffPct = 0;
      if (plot) {
        for (const row of rows) {
          const t = parseTime(row[timeIndex] ?? "");
          const i = t === null ? undefined : indexByTime.get(t);
          const expected = Number(row[col]);
          const actual = i === undefined ? NaN : plot.values[i];
          if (!Number.isFinite(expected) || !Number.isFinite(actual)) continue;
          matched++;
          const diff = Math.abs(actual - expected);
          maxAbsDiff = Math.max(maxAbsDiff, diff);
          if (expected !== 0) maxRelDiffPct = Math.max(maxRelDiffPct, (diff / Math.abs(expected)) * 100);
        }
      }
      return { column: name, plot: plot?.title ?? null, matched, maxAbsDiff, maxRelDiffPct, ok: matched > 0 && maxRelDiffPct <= TOLERANCE_PCT };
    });

  return { rows: rows.length, columns };
}
