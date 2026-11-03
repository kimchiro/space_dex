"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { createContext, use } from "react";
import type { StoredAccount } from "@/lib/extended/session";
import type { Hex } from "@/lib/extended/stark";

export type SetupStep = "derive" | "register" | "apiKey" | "verify";
export type SetupState = { status: "idle" } | { status: "running"; step: SetupStep } | { status: "error"; message: string };

export type WalletContextValue = {
  /** Privy 앱 ID가 설정되어 있는지 */
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  wallets: ConnectedWallet[];
  /** 사용자가 고른 서명 주소. 연결된 지갑 목록에 없으면 null */
  address: string | null;
  selectAddress: (address: string) => void;
  login: () => void;
  connectAnother: () => void;
  logout: () => Promise<void>;

  account: StoredAccount | null;
  /** 이번 세션에 Stark 키를 복원해 주문 서명이 가능한지 */
  unlocked: boolean;
  setup: SetupState;
  connectAccount: () => Promise<void>;
  lock: () => void;
  signingKey: () => Hex | null;

  /** 주소를 바꾸기 전 계정. 미체결 주문은 자동 취소되지 않아 따로 확인하게 한다. */
  previous: StoredAccount | null;
  dismissPrevious: () => void;

  panel: { open: boolean };
  openPanel: () => void;
  closePanel: () => void;
};

export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const value = use(WalletContext);
  if (!value) throw new Error("useWallet은 WalletProvider 안에서 써야 해요.");
  return value;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export const walletLabel = (wallet: ConnectedWallet) => {
  if (wallet.walletClientType === "privy") return "Privy 내장 지갑";
  return wallet.meta?.name || wallet.walletClientType;
};
