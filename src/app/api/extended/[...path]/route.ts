import type { NextRequest } from "next/server";
import { NETWORK, NETWORKS } from "@/lib/extended/config";
import { FORWARDED_HEADERS, USER_AGENT } from "@/lib/extended/headers";

/**
 * Extended REST 중계. Extended는 User-Agent를 요구하고 브라우저 CORS를 보장하지 않아서 서버를 거친다.
 * 키·서명 헤더는 그대로 넘기기만 하고 저장하거나 로그로 남기지 않는다.
 */
const ROUTES: Record<string, RegExp[]> = {
  GET: [
    /^\/api\/v1\/info\/starknet$/,
    /^\/api\/v1\/info\/markets$/,
    /^\/api\/v1\/info\/markets\/[A-Z0-9]+-[A-Z]+\/(orderbook|trades)$/,
    /^\/api\/v1\/user\/fees$/,
    /^\/api\/v1\/user\/account\/info$/,
    /^\/api\/v1\/user\/accounts$/,
    /^\/api\/v1\/user\/balance$/,
    /^\/api\/v1\/user\/orders$/,
    /^\/api\/v1\/user\/orders\/\d+$/,
    /^\/api\/v1\/user\/orders\/external\/\d+$/,
  ],
  POST: [
    /^\/auth\/onboard$/,
    /^\/api\/v1\/user\/account\/api-key$/,
    /^\/api\/v1\/user\/order$/,
    /^\/api\/v1\/user\/order\/rfq$/,
    ...(NETWORK === NETWORKS.testnet ? [/^\/api\/v1\/user\/claim$/] : []),
  ],
  DELETE: [/^\/api\/v1\/user\/order\/\d+$/],
};

async function relay(request: NextRequest, segments: string[]) {
  const path = `/${segments.join("/")}`;
  if (!ROUTES[request.method]?.some((re) => re.test(path))) {
    return Response.json({ status: "ERROR", error: { message: "허용되지 않은 Extended 경로예요." } }, { status: 404 });
  }

  const headers = new Headers({ "User-Agent": USER_AGENT, Accept: "application/json" });
  for (const [from, to] of FORWARDED_HEADERS) {
    const value = request.headers.get(from);
    if (value) headers.set(to, value);
  }

  let body: string | undefined;
  if (request.method === "POST") {
    body = await request.text();
    headers.set("Content-Type", "application/json");
  }

  try {
    const upstream = await fetch(`${NETWORK.origin}${path}${request.nextUrl.search}`, { method: request.method, headers, body, cache: "no-store" });
    // 큰 정수 ID가 깨지지 않도록 본문을 파싱하지 않고 그대로 돌려준다.
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ status: "ERROR", error: { message: "Extended 서버에 연결하지 못했어요." } }, { status: 502 });
  }
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Context) {
  return relay(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Context) {
  return relay(request, (await params).path);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return relay(request, (await params).path);
}
