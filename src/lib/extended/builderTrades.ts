import "server-only";
import BigNumber from "bignumber.js";
import { NETWORK } from "./config";
import { parseJson } from "./api";

type RawTrade = {
  id: string | number;
  time: number;
  volume: string;
  makerId: string | number | null;
  makerBuilderId: string | number | null;
  makerFee: string | null;
  makerBuilderFee: string | null;
  takerId: string | number | null;
  takerBuilderId: string | number | null;
  takerFee: string | null;
  takerBuilderFee: string | null;
};

/** 빌더가 참여한 쪽만 채워진다. 반대쪽 필드가 null인 것은 정상이다. */
export type BuilderTrade = {
  /** 체결 ID + 빌더 쪽. 같은 체결의 메이커·테이커 양쪽에 모두 빌더로 참여할 수 있어 둘을 합쳐 키로 쓴다. */
  key: string;
  tradeId: string;
  side: "maker" | "taker";
  time: number;
  accountId: string | null;
  volume: string;
  fee: string | null;
  builderFee: string;
  /** Extended 빌더 수수료 지급 기준(UTC 00:00) 날짜 */
  payoutDay: string;
  /** SPACEDEX 보상 마감 기준(KST 00:00) 날짜 */
  rewardDay: string;
};

const day = (time: number, offsetHours: number) => new Date(time + offsetHours * 3_600_000).toISOString().slice(0, 10);

function normalize(raw: RawTrade): BuilderTrade[] {
  const rows: BuilderTrade[] = [];
  for (const side of ["maker", "taker"] as const) {
    const builderFee = side === "maker" ? raw.makerBuilderFee : raw.takerBuilderFee;
    const builderId = side === "maker" ? raw.makerBuilderId : raw.takerBuilderId;
    if (builderFee === null || builderId === null) continue;
    const accountId = side === "maker" ? raw.makerId : raw.takerId;
    rows.push({
      key: `${raw.id}:${side}`,
      tradeId: String(raw.id),
      side,
      time: raw.time,
      accountId: accountId === null ? null : String(accountId),
      volume: raw.volume,
      fee: side === "maker" ? raw.makerFee : raw.takerFee,
      builderFee,
      payoutDay: day(raw.time, 0),
      rewardDay: day(raw.time, 9),
    });
  }
  return rows;
}

/** 최신 체결부터 cursor로 거슬러 올라가며 모은다. 중복은 key로 제거한다. */
export async function collectBuilderTrades(apiKey: string, { maxPages = 5, until }: { maxPages?: number; until?: string } = {}) {
  const seen = new Map<string, BuilderTrade>();
  let cursor: string | undefined;
  let reachedUntil = false;

  for (let page = 0; page < maxPages && !reachedUntil; page++) {
    const query = new URLSearchParams({ limit: "1000" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`${NETWORK.origin}/api/v1/builder/trades?${query}`, {
      headers: { "X-Api-Key": apiKey, "User-Agent": "SPACEDEX/0.1", Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`builder/trades ${response.status}`);
    const json = parseJson(await response.text()) as { data?: RawTrade[]; pagination?: { cursor?: string | number; count?: number } };

    for (const raw of json.data ?? []) {
      if (until && String(raw.id) === until) {
        reachedUntil = true;
        break;
      }
      for (const row of normalize(raw)) seen.set(row.key, row);
    }
    if (!json.pagination?.cursor || !json.data?.length) break;
    cursor = String(json.pagination.cursor);
  }

  const trades = [...seen.values()];
  const byPayoutDay: Record<string, string> = {};
  for (const t of trades) byPayoutDay[t.payoutDay] = new BigNumber(byPayoutDay[t.payoutDay] ?? 0).plus(t.builderFee).toString(10);

  return { trades, accruedByPayoutDay: byPayoutDay, nextCursor: cursor ?? null };
}
