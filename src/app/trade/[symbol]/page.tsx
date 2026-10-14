import { Suspense } from "react";
import { notFound } from "next/navigation";
import { findToken } from "@/data/tokens";
import { getMarketTokens } from "@/lib/coingecko";
import TradeView from "@/components/trade/TradeView";
import TradeSkeleton from "@/components/trade/TradeSkeleton";

export async function generateStaticParams() {
  const tokens = await getMarketTokens();
  return tokens.map((t) => ({ symbol: t.symbol }));
}

export default function TradePage({ params }: PageProps<"/trade/[symbol]">) {
  return (
    <Suspense fallback={<TradeSkeleton />}>
      <TradeContent params={params} />
    </Suspense>
  );
}

async function TradeContent({ params }: Pick<PageProps<"/trade/[symbol]">, "params">) {
  const { symbol } = await params;
  const token = findToken(await getMarketTokens(), symbol);
  if (!token) notFound();

  return <TradeView token={token} />;
}
