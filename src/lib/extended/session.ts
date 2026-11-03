"use client";

import { createLocalStore } from "@/lib/localStore";
import { ACCOUNT_INDEX, EXTENDED_NETWORK } from "./config";

/**
 * 지갑 주소별 Extended 계정 정보. API 키는 조회 전용이라 저장하지만,
 * Stark 개인키와 키 파생 서명은 절대 저장하지 않고 매 세션 서명으로 다시 만든다.
 */
export type StoredAccount = {
  address: string;
  accountId: string;
  vault: string;
  starkPublicKey: string;
  apiKey: string;
};

const accountsStore = createLocalStore<Record<string, StoredAccount>>("spacedex:extended-accounts", {});

/** 메인넷과 테스트넷 계정·키가 섞이지 않도록 환경과 accountIndex를 키에 넣는다. */
export const accountKey = (address: string) => `${EXTENDED_NETWORK}:${address.toLowerCase()}:${ACCOUNT_INDEX}`;

export const useStoredAccounts = accountsStore.useValue;

export const saveAccount = (account: StoredAccount) => accountsStore.write((prev) => ({ ...prev, [accountKey(account.address)]: account }));

export const forgetAccount = (address: string) =>
  accountsStore.write((prev) => {
    const next = { ...prev };
    delete next[accountKey(address)];
    return next;
  });

export const selectedAddressStore = createLocalStore<string | null>("spacedex:wallet-address", null);
