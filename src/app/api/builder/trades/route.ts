import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { collectBuilderTrades } from "@/lib/extended/builderTrades";

/**
 * 정산 1단계(발생) 수집용. SPACEDEX 빌더 계정의 체결별 빌더 수수료를 모은다.
 * 실제 입금 확인·지급 증빙은 원장 DB에서 별도 단계로 관리하고, 대시보드 수치를 입금액으로 쓰지 않는다.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.EXTENDED_BUILDER_API_KEY;
  const adminToken = process.env.BUILDER_ADMIN_TOKEN;
  if (!apiKey || !adminToken) return Response.json({ error: "빌더 정산 환경변수가 설정되지 않았어요." }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(adminToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "권한이 없어요." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const maxPages = Math.min(Math.max(Number(params.get("pages")) || 5, 1), 20);
  const until = params.get("until") ?? undefined;

  try {
    return Response.json(await collectBuilderTrades(apiKey, { maxPages, until }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Extended 빌더 체결을 가져오지 못했어요." }, { status: 502 });
  }
}
