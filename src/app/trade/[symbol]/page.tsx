import { Suspense } from "react";
import { notFound } from "next/navigation";
import { findToken, tokens } from "@/data/tokens";
import TradeView from "@/components/trade/TradeView";
import TradeSkeleton from "@/components/trade/TradeSkeleton";

export function generateStaticParams() {
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
  const token = findToken(symbol);
  if (!token) notFound();

  return <TradeView token={token} />;
}
