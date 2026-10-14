import { getCryptoNews } from "@/lib/news";

export async function GET() {
  return Response.json(await getCryptoNews());
}
