import BigNumber from "bignumber.js";
import type { Market, StarknetDomain } from "./api";
import type { FeeCheck } from "./fees";
import { loadStarkCrypto, orderMessageHash, starkPublicKey, starkSign, type Hex } from "./stark";

export type OrderSide = "BUY" | "SELL";
export type OrderKind = "LIMIT" | "MARKET";

export type OrderInput = {
  market: Market;
  side: OrderSide;
  kind: OrderKind;
  qty: string;
  /** 지정가. 시장가에서는 감수할 최악 가격이다. */
  price: string;
  postOnly?: boolean;
  reduceOnly?: boolean;
};

export type OrderSigner = { privateKey: Hex; vault: string; domain: StarknetDomain };

const EXPIRY_MS = 60 * 60 * 1000;
const SETTLEMENT_BUFFER_SECONDS = 14 * 24 * 60 * 60;
const MARKET_SLIPPAGE = new BigNumber("0.0075");

const hex = (n: BigNumber) => `0x${n.toString(16)}`;

const isMultiple = (value: BigNumber, step: BigNumber) => value.mod(step).isZero();

/** 시장가 주문의 최악 가격: 매수는 위로, 매도는 아래로 여유를 두고 호가 단위에 맞춘다. */
export function worstPrice(market: Market, side: OrderSide) {
  const step = new BigNumber(market.tradingConfig.minPriceChange);
  const mark = new BigNumber(market.marketStats.markPrice);
  const raw = side === "BUY" ? mark.times(MARKET_SLIPPAGE.plus(1)) : mark.times(new BigNumber(1).minus(MARKET_SLIPPAGE));
  return raw.div(step).integerValue(side === "BUY" ? BigNumber.ROUND_DOWN : BigNumber.ROUND_UP).times(step).toString(10);
}

export function validateOrder(input: OrderInput): string | null {
  const { tradingConfig } = input.market;
  const qty = new BigNumber(input.qty);
  const price = new BigNumber(input.price);
  if (!qty.isFinite() || qty.lte(0)) return "수량을 입력해 주세요.";
  if (!price.isFinite() || price.lte(0)) return "가격을 입력해 주세요.";
  if (qty.lt(tradingConfig.minOrderSize)) return `최소 주문 수량은 ${tradingConfig.minOrderSize}예요.`;
  if (!isMultiple(qty, new BigNumber(tradingConfig.minOrderSizeChange))) return `수량은 ${tradingConfig.minOrderSizeChange} 단위로 입력해 주세요.`;
  if (!isMultiple(price, new BigNumber(tradingConfig.minPriceChange))) return `가격은 ${tradingConfig.minPriceChange} 단위로 입력해 주세요.`;
  if (input.market.isRfq && input.postOnly) return "RFQ 마켓은 Post-only 주문을 지원하지 않아요.";
  if (!input.market.active || input.market.status !== "ACTIVE") return "지금은 주문할 수 없는 마켓이에요.";
  return null;
}

/**
 * Extended 공식 TS 예제(Order.create)와 같은 방식으로 주문을 만들고 서명한다.
 * - 서명 금액의 수수료 = (기본 수수료율 + 빌더 수수료) × 주문 금액, 한 번만 합산
 * - 본문의 fee에는 기본 수수료율만, builderFee는 따로 보낸다
 * 서명 뒤에 반환 객체를 고치면 서명과 본문이 달라지므로 동결해서 돌려준다.
 */
export async function createSignedOrder(input: OrderInput, fee: Extract<FeeCheck, { ok: true }>, signer: OrderSigner) {
  const invalid = validateOrder(input);
  if (invalid) throw new Error(invalid);
  if (fee.market !== input.market.name) throw new Error("수수료 확인 결과와 주문 마켓이 달라요.");

  await loadStarkCrypto();

  const { market, side } = input;
  const qty = new BigNumber(input.qty);
  const price = new BigNumber(input.price);
  const rounding = side === "BUY" ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN;

  const nonce = Math.floor(Math.random() * (2 ** 31 - 2)) + 1;
  const expiryEpochMillis = Date.now() + EXPIRY_MS;
  const expiration = Math.ceil(expiryEpochMillis / 1000) + SETTLEMENT_BUFFER_SECONDS;

  const totalFeeRate = fee.baseFeeRate.plus(fee.builderFee);
  const collateral = qty.times(price);
  const collateralStark = collateral.times(market.l2Config.collateralResolution).integerValue(rounding);
  const feeStark = totalFeeRate.times(collateral).times(market.l2Config.collateralResolution).integerValue(BigNumber.ROUND_UP);
  const syntheticStark = qty.times(market.l2Config.syntheticResolution).integerValue(rounding);

  const [collateralAmount, syntheticAmount] = side === "BUY" ? [collateralStark.negated(), syntheticStark] : [collateralStark, syntheticStark.negated()];

  const collateralId = hex(new BigNumber(market.l2Config.collateralId, 16));
  const publicKey = starkPublicKey(signer.privateKey);
  const { domain } = signer;

  const hash = orderMessageHash(
    signer.vault,
    hex(new BigNumber(market.l2Config.syntheticId, 16)),
    syntheticAmount.toString(10),
    collateralId,
    collateralAmount.toString(10),
    collateralId,
    feeStark.toString(10),
    String(expiration),
    String(nonce),
    publicKey,
    domain.name,
    domain.version,
    domain.chainId,
    String(domain.revision),
  );
  const signature = starkSign(hash, signer.privateKey);

  const body = Object.freeze({
    id: BigInt(hash).toString(10),
    market: market.name,
    type: input.kind,
    side,
    qty: qty.toString(10),
    price: price.toString(10),
    timeInForce: input.kind === "MARKET" ? "IOC" : "GTT",
    expiryEpochMillis,
    fee: fee.baseFeeRate.toString(10),
    nonce: String(nonce),
    settlement: { signature, starkKey: publicKey, collateralPosition: signer.vault },
    reduceOnly: input.reduceOnly ?? false,
    postOnly: market.isRfq ? false : (input.postOnly ?? false),
    selfTradeProtectionLevel: "ACCOUNT",
    // Extended 주문 API는 builderId를 숫자로만 받는다. 문자열이면 "Builder ID is not valid"가 반환된다.
    builderId: fee.builderId,
    builderFee: fee.builderFee.toString(10),
    debuggingAmounts: { collateralAmount: collateralStark.toString(10), feeAmount: feeStark.toString(10), syntheticAmount: syntheticStark.toString(10) },
  });

  return { body, endpoint: market.isRfq ? "/api/v1/user/order/rfq" : "/api/v1/user/order", externalId: body.id };
}
