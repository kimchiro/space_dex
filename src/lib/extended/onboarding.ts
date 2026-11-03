import { ACCOUNT_INDEX, API_KEY_PATH, NETWORK } from "./config";
import { extendedRequest, type AccountInfo } from "./api";
import { deriveStarkPrivateKey, loadStarkCrypto, registrationHash, starkPublicKey, starkSign, type Hex } from "./stark";

export { sameKey } from "./stark";

/** 사용자가 직접 고른 EVM 서명 주소. 여러 지갑 중 첫 번째를 자동으로 쓰지 않는다. */
export type EvmSigner = {
  /** 체크섬 주소 */
  address: string;
  signTypedData: (typedData: TypedData) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
};

export type TypedData = {
  types: Record<string, { name: string; type: string }[]>;
  domain: { name: string };
  primaryType: string;
  message: Record<string, unknown>;
};

const DOMAIN_TYPE = [{ name: "name", type: "string" }];

/** Extended 시각 포맷: UTC, 초 단위, `Z` 접미사. */
const utcSeconds = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/** ① 키 파생용 AccountCreation. 이 서명으로 Stark 개인키가 다시 만들어지므로 외부로 보내지 않는다. */
export const accountCreationTypedData = (wallet: string, accountIndex = ACCOUNT_INDEX): TypedData => ({
  types: {
    EIP712Domain: DOMAIN_TYPE,
    AccountCreation: [
      { name: "accountIndex", type: "int8" },
      { name: "wallet", type: "address" },
      { name: "tosAccepted", type: "bool" },
    ],
  },
  domain: { name: NETWORK.signingDomain },
  primaryType: "AccountCreation",
  message: { accountIndex, wallet, tosAccepted: true },
});

/** ② 서버 등록용 AccountRegistration. 키 파생 서명과 별개의 서명이다. */
const accountRegistration = (wallet: string, time: string) => ({
  accountIndex: 0,
  wallet,
  tosAccepted: true,
  time,
  action: "REGISTER",
  host: NETWORK.origin,
});

const accountRegistrationTypedData = (registration: ReturnType<typeof accountRegistration>): TypedData => ({
  types: {
    EIP712Domain: DOMAIN_TYPE,
    AccountRegistration: [
      { name: "accountIndex", type: "int8" },
      { name: "wallet", type: "address" },
      { name: "tosAccepted", type: "bool" },
      { name: "time", type: "string" },
      { name: "action", type: "string" },
      { name: "host", type: "string" },
    ],
  },
  domain: { name: NETWORK.signingDomain },
  primaryType: "AccountRegistration",
  message: registration,
});

export type StarkKeys = { privateKey: Hex; publicKey: Hex };

export async function deriveStarkKeys(signer: EvmSigner): Promise<StarkKeys> {
  await loadStarkCrypto();
  const signature = await signer.signTypedData(accountCreationTypedData(signer.address));
  const privateKey = deriveStarkPrivateKey(signature);
  return { privateKey, publicKey: starkPublicKey(privateKey) };
}

type OnboardResponse = { defaultAccount?: AccountInfo & { id?: string | number }; default_account?: AccountInfo & { id?: string | number } };

/** ③ `/auth/onboard`. 이미 등록된 지갑이면 기존 기본 계정을 돌려준다. */
export async function registerAccount(signer: EvmSigner, keys: StarkKeys, referralCode?: string) {
  const registration = accountRegistration(signer.address, utcSeconds());
  const l1Signature = await signer.signTypedData(accountRegistrationTypedData(registration));
  const l2Signature = starkSign(registrationHash(signer.address, keys.publicKey), keys.privateKey);

  const data = await extendedRequest<OnboardResponse>("/auth/onboard", {
    method: "POST",
    body: { l1Signature, l2Key: keys.publicKey, l2Signature, accountCreation: registration, referralCode: referralCode ?? null },
  });
  const account = data.defaultAccount ?? data.default_account;
  if (!account) throw new Error("Extended가 계정 정보를 돌려주지 않았어요.");
  return { accountId: String(account.accountId ?? account.id), l2Vault: String(account.l2Vault), l2Key: account.l2Key };
}

/** ④ API 키 발급. EIP-191로 `경로@시각`을 서명해 지갑 소유를 증명한다. */
export async function createApiKey(signer: EvmSigner, accountId: string) {
  const time = utcSeconds();
  const signature = await signer.signMessage(`${API_KEY_PATH}@${time}`);
  const data = await extendedRequest<{ key: string }>(API_KEY_PATH, {
    method: "POST",
    accountId,
    l1: { signature, time },
    body: { description: "SPACEDEX" },
  });
  if (!data?.key) throw new Error("Extended가 API 키를 돌려주지 않았어요.");
  return data.key;
}
