import type { NextRequest } from "next/server";
import { CHART_DAYS, getPriceHistory, type ChartDays } from "@/lib/priceHistory";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const days = Number(request.nextUrl.searchParams.get("days")) as ChartDays;

  if (!id || !CHART_DAYS.includes(days)) {
    return Response.json({ error: "id와 days(1, 7, 30, 90, 365)가 필요해요." }, { status: 400 });
  }

  const points = await getPriceHistory(id, days);
  if (!points) return Response.json({ error: "가격 히스토리를 불러오지 못했어요." }, { status: 502 });

  return Response.json(points);
}
