import type { NextRequest } from "next/server";
import { CHART_DAYS, getPriceHistory, type ChartDays } from "@/lib/priceHistory";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const days = Number(request.nextUrl.searchParams.get("days")) as ChartDays;

  if (!id || !CHART_DAYS.includes(days)) {
    return Response.json({ error: "id와 days(1, 7, 30, 90, 365)가 필요해요." }, { status: 400 });
  }

  // 코인게코 호출 한도 등으로 데이터가 없으면 null을 돌려주고, 화면은 예시 데이터로 대체한다.
  return Response.json(await getPriceHistory(id, days));
}
