import initWasm, { generate_private_key_from_eth_signature, get_order_msg, sign_message } from "@x10xchange/stark-crypto-wrapper-wasm";
import { ec } from "starknet";

/**
 * Extended 공식 WASM 서명 모듈. 로드에 실패하면 서명 단계에서 막는다(대체 구현으로 서명하지 않는다).
 * Node에는 URL로 .wasm을 불러올 fetch가 없어서, 서버 스크립트는 파일 내용을 처음 한 번 넘긴다.
 */
let ready: Promise<unknown> | null = null;
export const loadStarkCrypto = (wasm?: BufferSource) => {
  ready ??= initWasm(wasm && { module_or_path: wasm }).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
};

export type Hex = `0x${string}`;

const toHex = (value: string | bigint): Hex => {
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
};

/** 같은 지갑·환경·accountIndex의 AccountCreation 서명이면 항상 같은 키가 나온다. 서명 원문은 비밀번호처럼 다룬다. */
export function deriveStarkPrivateKey(accountCreationSignature: string): Hex {
  return toHex(generate_private_key_from_eth_signature(accountCreationSignature));
}

export const starkPublicKey = (privateKey: Hex): Hex => toHex(ec.starkCurve.getStarkKey(privateKey));

export function starkSign(messageHash: Hex, privateKey: Hex) {
  const signature = sign_message(privateKey, messageHash);
  const result = { r: toHex(signature.r), s: toHex(signature.s) };
  signature.free();
  return result;
}

/** 계정 등록용 L2 메시지: pedersen(지갑 주소, Stark 공개키). */
export const registrationHash = (wallet: string, publicKey: Hex): Hex => toHex(ec.starkCurve.pedersen(BigInt(wallet), BigInt(publicKey)));

export const orderMessageHash = (...args: Parameters<typeof get_order_msg>): Hex => toHex(get_order_msg(...args));

export const sameKey = (a: string, b: string) => BigInt(a) === BigInt(b);
