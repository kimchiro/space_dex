/**
 * 테스트넷 전용 호가 공급 봇. 회사 소유의 별도 테스트넷 지갑으로 Extended에 매수·매도 지정가(post-only)를 건다.
 * 사용자 지갑·빌더 계정과 섞지 않고, 메인넷 설정이면 시작하지 않는다.
 *
 *   npm run maker:testnet
 *
 * 필요한 값(.env.local, 서버 전용): TESTNET_MAKER_PRIVATE_KEY — 이 봇만 쓰는 테스트넷용 EVM 개인키.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import BigNumber from "bignumber.js";
import { privateKeyToAccount } from "viem/accounts";
import { getMarketDepth } from "@/lib/binance";
import { claimTestFunds, extendedRequest, getBalance, getFees, getMarket, getStarknetDomain, placeOrder, type Market } from "@/lib/extended/api";
import { EXTENDED_NETWORK, NETWORK } from "@/lib/extended/config";
import { FORWARDED_HEADERS, USER_AGENT } from "@/lib/extended/headers";
import { createApiKey, deriveStarkKeys, registerAccount, type EvmSigner } from "@/lib/extended/onboarding";
import { createSignedOrder, type OrderSide } from "@/lib/extended/order";
import { loadStarkCrypto } from "@/lib/extended/stark";

const MARKETS = (process.env.TESTNET_MAKER_MARKETS ?? "BTC-USD,ETH-USD,SOL-USD").split(",").map((m) => m.trim()).filter(Boolean);
const LEVELS = Number(process.env.TESTNET_MAKER_LEVELS ?? 5);
/** 최우선 호가와 기준가 사이 간격, 호가 사이 간격(비율). */
const FIRST_GAP = new BigNumber(process.env.TESTNET_MAKER_SPREAD ?? "0.0005");
const STEP_GAP = new BigNumber(process.env.TESTNET_MAKER_STEP ?? "0.0005");
const REFRESH_MS = Number(process.env.TESTNET_MAKER_REFRESH_MS ?? 15_000);
/** 기준가가 호가 간격의 절반 이상 움직였거나 이 시간이 지났을 때만 호가를 다시 건다. 주문 유효기간(1시간)보다 짧아야 한다. */
const MAX_QUOTE_AGE_MS = 5 * 60_000;
/** 바이낸스 가격이 Extended 마크 가격과 이만큼 넘게 벌어지면 마크 가격을 기준으로 쓴다. */
const MAX_DRIFT = new BigNumber("0.01");
const MIN_AVAILABLE = new BigNumber(200);
/** 봇이 죽어도 이 시간이 지나면 Extended가 걸어 둔 주문을 모두 취소한다. */
const DEAD_MAN_SECONDS = Math.ceil((REFRESH_MS * 4) / 1000);

const log = (...args: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (EXTENDED_NETWORK !== "testnet") {
  console.error("메인넷 설정에서는 호가 봇을 실행하지 않아요. (NEXT_PUBLIC_EXTENDED_NETWORK)");
  process.exit(1);
}
const privateKey = process.env.TESTNET_MAKER_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error("TESTNET_MAKER_PRIVATE_KEY(0x로 시작하는 64자리 16진수)가 필요해요.");
  process.exit(1);
}

const require = createRequire(import.meta.url);
await loadStarkCrypto(readFileSync(require.resolve("@x10xchange/stark-crypto-wrapper-wasm/stark_crypto_wrapper_wasm_bg.wasm")));

// 앱 코드의 /api/extended 중계 호출을 이 프로세스에서는 Extended로 직접 보낸다.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("/api/extended/")) return nativeFetch(input, init);
  const from = new Headers(init?.headers);
  const headers = new Headers({ "User-Agent": USER_AGENT, Accept: "application/json" });
  for (const [name, to] of FORWARDED_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(to, value);
  }
  if (from.has("content-type")) headers.set("Content-Type", "application/json");
  return nativeFetch(`${NETWORK.origin}${url.slice("/api/extended".length)}`, { ...init, headers });
}) as typeof fetch;

const wallet = privateKeyToAccount(privateKey as `0x${string}`);
const signer: EvmSigner = {
  address: wallet.address,
  signTypedData: (typedData) => {
    const types = { ...typedData.types };
    delete types.EIP712Domain;
    return wallet.signTypedData({ domain: typedData.domain, types, primaryType: typedData.primaryType, message: typedData.message });
  },
  signMessage: (message) => wallet.signMessage({ message }),
};

const keys = await deriveStarkKeys(signer);
const account = await registerAccount(signer, keys);
const auth = { apiKey: await createApiKey(signer, account.accountId) };
const domain = await getStarknetDomain();
log(`호가 봇 계정 ${wallet.address} · accountId ${account.accountId} · ${MARKETS.join(", ")}`);

const userRequest = <T,>(path: string, body: unknown, query?: Record<string, string>) => extendedRequest<T>(path, { ...auth, method: "POST", body, query });
const cancelAll = () => userRequest("/api/v1/user/order/massCancel", { markets: MARKETS });

async function ensureFunds() {
  const balance = await getBalance(auth);
  const available = new BigNumber(balance?.availableForTrade ?? 0);
  if (available.gte(MIN_AVAILABLE)) return available;
  try {
    await claimTestFunds(auth);
    log("테스트 USDC를 요청했어요.");
    for (let i = 0; i < 10; i++) {
      await sleep(1500);
      const next = await getBalance(auth);
      if (new BigNumber(next?.availableForTrade ?? 0).gt(available)) return new BigNumber(next!.availableForTrade);
    }
  } catch (e) {
    log("테스트 USDC 요청 실패(지갑당 하루 한도일 수 있어요):", e instanceof Error ? e.message : e);
  }
  return available;
}

const roundTo = (value: BigNumber, step: string, mode: BigNumber.RoundingMode) => value.div(step).integerValue(mode).times(step);

/** 바이낸스 중간가를 기준으로 하되, Extended 마크 가격과 크게 다르면 마크 가격을 쓴다. */
async function referencePrice(market: Market) {
  const mark = new BigNumber(market.marketStats.markPrice);
  const binance = await getMarketDepth(market.assetName, 1, 1);
  const bid = binance.supported ? binance.depth?.bids[0]?.price : undefined;
  const ask = binance.supported ? binance.depth?.asks[0]?.price : undefined;
  if (!bid || !ask) return { price: mark, from: "Extended 마크" };
  const mid = new BigNumber(bid).plus(ask).div(2);
  if (mark.gt(0) && mid.minus(mark).abs().div(mark).gt(MAX_DRIFT)) return { price: mark, from: "Extended 마크(바이낸스 괴리)" };
  return { price: mid, from: "Binance" };
}

type Quotes = { ref: BigNumber; at: number; ids: string[] };

async function quote(name: string, previous: Quotes | undefined): Promise<Quotes> {
  const market = await getMarket(name);
  const { price: ref, from } = await referencePrice(market);
  if (!ref.isFinite() || ref.lte(0)) throw new Error("기준 가격이 없어요.");
  if (previous && Date.now() - previous.at < MAX_QUOTE_AGE_MS && ref.minus(previous.ref).abs().div(previous.ref).lt(STEP_GAP.div(2))) return previous;

  const fees = await getFees(auth, name);
  const baseFeeRate = BigNumber.max(fees[0].makerFeeRate, fees[0].takerFeeRate);
  const { minOrderSize, minPriceChange } = market.tradingConfig;

  const placed: string[] = [];
  for (let level = 0; level < LEVELS; level++) {
    const gap = FIRST_GAP.plus(STEP_GAP.times(level));
    const qty = new BigNumber(minOrderSize).times(level + 1).toString(10);
    for (const side of ["BUY", "SELL"] as OrderSide[]) {
      const raw = side === "BUY" ? ref.times(BigNumber(1).minus(gap)) : ref.times(gap.plus(1));
      const price = roundTo(raw, minPriceChange, side === "BUY" ? BigNumber.ROUND_DOWN : BigNumber.ROUND_UP).toString(10);
      const { body, endpoint } = await createSignedOrder(
        { market, side, kind: "LIMIT", qty, price, postOnly: true },
        { ok: true, market: name, baseFeeRate, builderFee: new BigNumber(0), cap: new BigNumber(0), builderId: 0 },
        { privateKey: keys.privateKey, vault: account.l2Vault, domain },
      );
      // 회사 호가 주문에는 빌더 수수료를 붙이지 않는다.
      const order = { ...body, builderId: undefined, builderFee: undefined };
      try {
        await placeOrder(auth, endpoint, order);
        placed.push(order.id);
      } catch (e) {
        log(`${name} ${side} ${price} 실패:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // 새 호가를 먼저 건 뒤 이전 호가를 지워 호가창이 비는 순간을 없앤다.
  if (previous?.ids.length) await userRequest("/api/v1/user/order/massCancel", { externalOrderIds: previous.ids }).catch((e) => log(`${name} 이전 호가 취소 실패:`, e.message));
  log(`${name} 기준 ${ref.toFixed(2)}(${from}) · 주문 ${placed.length}/${LEVELS * 2}`);
  return { ref, at: Date.now(), ids: placed };
}

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  log("종료: 걸어 둔 호가를 취소해요.");
  await cancelAll().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await cancelAll().catch(() => {});
const open = new Map<string, Quotes>();
let round = 0;
while (!stopping) {
  try {
    if (round % 20 === 0) log(`거래 가능 잔액 ${(await ensureFunds()).toFixed(2)} USD`);
    await userRequest("/api/v1/user/deadmanswitch", undefined, { countdownTime: String(DEAD_MAN_SECONDS) });
    for (const name of MARKETS) {
      try {
        open.set(name, await quote(name, open.get(name)));
      } catch (e) {
        log(`${name} 호가 갱신 실패:`, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    log("갱신 실패:", e instanceof Error ? e.message : e);
  }
  round++;
  await sleep(REFRESH_MS);
}
