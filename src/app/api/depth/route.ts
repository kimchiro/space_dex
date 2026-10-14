import type { NextRequest } from "next/server";
import { getMarketDepth } from "@/lib/binance";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) return Response.json({ error: "symbol이 필요해요." }, { status: 400 });

  return Response.json(await getMarketDepth(symbol));
}
