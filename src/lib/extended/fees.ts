import BigNumber from "bignumber.js";
import { BUILDER_FEE, BUILDER_ID } from "./config";
import { getFees } from "./api";

export type FeeCheck =
  | { ok: true; market: string; baseFeeRate: BigNumber; builderFee: BigNumber; cap: BigNumber; builderId: number }
  | { ok: false; market: string; reason: string };

// Extended 수수료가 10%를 넘을 일은 없으므로 그 이상은 단위 오류로 보고 거부한다.
const SANE_MAX = new BigNumber("0.1");

const parseRate = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const n = new BigNumber(value);
  return n.isFinite() && n.gte(0) && n.lte(SANE_MAX) ? n : null;
};

/**
 * 사용자·마켓·builderId 기준으로 허용 상한을 조회해 원하는 빌더 수수료가 들어가는지 확인한다.
 * 기본 수수료율에 빌더 수수료를 미리 더하지 않는다. 서명 금액에서만 SDK 방식대로 한 번 합산한다.
 */
export async function checkBuilderFee(apiKey: string, market: string): Promise<FeeCheck> {
  if (BUILDER_ID === null) return { ok: false, market, reason: "빌더 ID는 숫자여야 해요. (NEXT_PUBLIC_EXTENDED_BUILDER_ID)" };

  const wanted = new BigNumber(BUILDER_FEE);
  const rows = await getFees({ apiKey }, market, String(BUILDER_ID));
  const row = rows?.find((r) => r.market === market);
  if (!row) return { ok: false, market, reason: "수수료 응답에 해당 마켓이 없어요." };

  const maker = parseRate(row.makerFeeRate);
  const taker = parseRate(row.takerFeeRate);
  if (!maker || !taker) return { ok: false, market, reason: "기본 수수료율 값이 올바르지 않아요." };

  const cap = parseRate(row.builderFeeRate);
  // builderId가 승인되지 않았으면 상한이 "0"으로 온다.
  if (!cap || cap.isZero()) return { ok: false, market, reason: "빌더 수수료 상한이 없어요. Extended에 빌더 승인이 되었는지 확인해 주세요." };
  if (wanted.gt(cap)) return { ok: false, market, reason: `빌더 수수료 ${wanted.times(100)}%가 허용 상한 ${cap.times(100)}%를 넘어요.` };

  return { ok: true, market, baseFeeRate: BigNumber.max(maker, taker), builderFee: wanted, cap, builderId: BUILDER_ID };
}
