import type { NextRequest } from "next/server";
import { getMarketDepth } from "@/lib/binance";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) return Response.json({ error: "symbol이 필요해요." }, { status: 400 });

  const depth = await getMarketDepth(symbol);
  if (!depth) return Response.json({ error: "호가 데이터를 제공하지 않는 코인이에요." }, { status: 404 });

  return Response.json(depth);
}
