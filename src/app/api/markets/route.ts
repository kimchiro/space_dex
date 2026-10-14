import { getMarketTokens } from "@/lib/coingecko";

export async function GET() {
  return Response.json(await getMarketTokens());
}
