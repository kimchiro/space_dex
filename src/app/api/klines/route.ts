import type { NextRequest } from "next/server";
import { getKlines } from "@/lib/binance";
import { isIntervalKey, MAX_CANDLES } from "@/lib/market/candles";

const toNumber = (value: string | null) => (value === null || value === "" ? undefined : Number(value));

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = params.get("symbol");
  const interval = params.get("interval");
  const limit = toNumber(params.get("limit")) ?? 500;
  const start = toNumber(params.get("start"));
  const end = toNumber(params.get("end"));

  if (!symbol || !isIntervalKey(interval) || !Number.isFinite(limit) || [start, end].some((v) => v !== undefined && !Number.isFinite(v))) {
    return Response.json({ error: "symbol, interval(1m·5m·15m·1h·4h·1d)이 필요해요." }, { status: 400 });
  }

  const result = await getKlines(symbol, interval, {
    limit: Math.min(Math.max(1, Math.floor(limit)), MAX_CANDLES),
    start,
    end,
  });
  return Response.json(result);
}
