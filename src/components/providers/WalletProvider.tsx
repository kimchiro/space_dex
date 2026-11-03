"use client";

import { PrivyProvider, usePrivy, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAddress, isAddressEqual, recoverMessageAddress, recoverTypedDataAddress, stringToHex, type Hex as ViemHex } from "viem";
import { theme } from "@/styles/theme";
import { ExtendedError, getAccountInfo } from "@/lib/extended/api";
import type { EvmSigner } from "@/lib/extended/onboarding";
import { accountKey, forgetAccount, saveAccount, selectedAddressStore, useStoredAccounts, type StoredAccount } from "@/lib/extended/session";
import type { Hex } from "@/lib/extended/stark";
import { WalletContext, type SetupState, type WalletContextValue } from "@/components/wallet/context";
import WalletModal from "@/components/wallet/WalletModal";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;

const ADDRESS_MISMATCH = "선택한 주소가 아닌 다른 주소로 서명됐어요. 지갑에서 계정을 확인해 주세요.";

/** 지갑 연결 UI와 세션은 Privy 하나가 맡는다. 별도 AppKit 모달을 함께 띄우지 않는다. */
export default function WalletProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const panel = { open: panelOpen };
  const panelProps = { panel, openPanel, closePanel };

  if (!PRIVY_APP_ID) return <Unconfigured {...panelProps}>{children}</Unconfigured>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "light",
          accentColor: theme.colors.primary,
          showWalletLoginFirst: true,
          walletChainType: "ethereum-only",
          // 모바일에서 QR만 보이지 않도록 딥링크(wallet_connect)와 QR을 함께 둔다.
          walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect", "wallet_connect_qr"],
        },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        walletConnectCloudProjectId: WALLETCONNECT_PROJECT_ID,
      }}
    >
      <PrivyBridge {...panelProps}>{children}</PrivyBridge>
    </PrivyProvider>
  );
}

type PanelProps = Pick<WalletContextValue, "panel" | "openPanel" | "closePanel"> & { children: ReactNode };

const noop = () => {};

function Unconfigured({ children, ...panel }: PanelProps) {
  const value: WalletContextValue = {
    configured: false,
    ready: true,
    authenticated: false,
    wallets: [],
    address: null,
    selectAddress: noop,
    login: noop,
    connectAnother: noop,
    logout: async () => {},
    account: null,
    unlocked: false,
    setup: { status: "idle" },
    connectAccount: async () => {},
    lock: noop,
    signingKey: () => null,
    previous: null,
    dismissPrevious: noop,
    ...panel,
  };
  return (
    <WalletContext value={value}>
      {children}
      <WalletModal />
    </WalletContext>
  );
}

/** 서명 결과를 복원해 사용자가 고른 주소로 서명했는지 확인한다. */
async function createSigner(wallet: ConnectedWallet): Promise<EvmSigner> {
  const provider = await wallet.getEthereumProvider();
  const address = getAddress(wallet.address);

  return {
    address,
    async signTypedData(typedData) {
      const signature = (await provider.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(typedData)] })) as ViemHex;
      const signer = await recoverTypedDataAddress({ ...typedData, signature } as Parameters<typeof recoverTypedDataAddress>[0]);
      if (!isAddressEqual(signer, address)) throw new Error(ADDRESS_MISMATCH);
      return signature;
    },
    async signMessage(message) {
      const signature = (await provider.request({ method: "personal_sign", params: [stringToHex(message), address] })) as ViemHex;
      if (!isAddressEqual(await recoverMessageAddress({ message, signature }), address)) throw new Error(ADDRESS_MISMATCH);
      return signature;
    },
  };
}

/** 사용자 메시지만 남긴다. 서명·키가 섞일 수 있는 원본 오류 객체는 로그나 외부로 보내지 않는다. */
function describeError(error: unknown) {
  const e = error as { code?: number; message?: string } | null;
  if (e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "")) return "지갑에서 서명을 취소했어요.";
  if (error instanceof Error && error.message) return error.message;
  return "알 수 없는 오류가 발생했어요.";
}

function PrivyBridge({ children, ...panel }: PanelProps) {
  const { ready, authenticated, login, connectWallet, logout } = usePrivy();
  const { wallets: allWallets, ready: walletsReady } = useWallets();
  const wallets = useMemo(() => allWallets.filter((w) => w.type === "ethereum"), [allWallets]);

  const selected = selectedAddressStore.useValue();
  const wallet = wallets.find((w) => selected && w.address.toLowerCase() === selected.toLowerCase()) ?? null;
  const address = wallet ? getAddress(wallet.address) : null;

  const accounts = useStoredAccounts();
  const account = address ? (accounts[accountKey(address)] ?? null) : null;

  // 잠금 해제·진행 상태는 주소에 묶어 두어, 주소가 바뀌거나 지갑이 끊기면 곧바로 잠기고 새 주문이 막힌다.
  const keyRef = useRef<{ address: string; privateKey: Hex } | null>(null);
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  const unlocked = address !== null && unlockedFor === address;
  const [setupState, setSetupState] = useState<{ address: string | null; state: SetupState }>({ address: null, state: { status: "idle" } });
  const setup: SetupState = setupState.address === address ? setupState.state : { status: "idle" };
  const setSetup = useCallback((state: SetupState) => setSetupState({ address, state }), [address]);

  useEffect(() => {
    if (keyRef.current && keyRef.current.address !== address) keyRef.current = null;
  }, [address]);

  const [previous, setPrevious] = useState<StoredAccount | null>(null);
  const [trackedAddress, setTrackedAddress] = useState(address);
  if (trackedAddress !== address) {
    setTrackedAddress(address);
    if (trackedAddress && address) setPrevious(accounts[accountKey(trackedAddress)] ?? null);
  }

  const selectAddress = useCallback((next: string) => selectedAddressStore.write(getAddress(next)), []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setUnlockedFor(null);
  }, []);

  const handleLogout = useCallback(async () => {
    lock();
    setPrevious(null);
    selectedAddressStore.write(null);
    await logout();
  }, [lock, logout]);

  const connectAccount = useCallback(async () => {
    if (!wallet || !address || setup.status === "running") return;
    try {
      // Stark 서명 모듈(WASM 포함)은 계정 연결을 시작할 때만 불러온다.
      const { createApiKey, deriveStarkKeys, registerAccount, sameKey } = await import("@/lib/extended/onboarding");
      const signer = await createSigner(wallet);
      setSetup({ status: "running", step: "derive" });
      const keys = await deriveStarkKeys(signer);

      // 같은 주소·환경·accountIndex면 같은 공개키가 나와야 한다.
      if (account && sameKey(account.starkPublicKey, keys.publicKey)) {
        setSetup({ status: "running", step: "verify" });
        try {
          const info = await getAccountInfo({ apiKey: account.apiKey });
          if (!sameKey(info.l2Key, keys.publicKey)) throw new Error("Extended 계정의 공개키가 이 지갑에서 만든 키와 달라요.");
          keyRef.current = { address, privateKey: keys.privateKey };
          setUnlockedFor(address);
          setSetup({ status: "idle" });
          return;
        } catch (e) {
          // API 키가 폐기됐으면 같은 키로 다시 등록하고 새 키를 받는다.
          if (!(e instanceof ExtendedError && e.status === 401)) throw e;
          forgetAccount(address);
        }
      } else if (account) {
        throw new Error("저장된 계정과 다른 Stark 키가 만들어졌어요. 네트워크와 지갑 주소를 확인해 주세요.");
      }

      setSetup({ status: "running", step: "register" });
      const registered = await registerAccount(signer, keys);
      if (!sameKey(registered.l2Key, keys.publicKey)) throw new Error("Extended에 등록된 키가 이 지갑에서 만든 키와 달라요.");

      setSetup({ status: "running", step: "apiKey" });
      const apiKey = await createApiKey(signer, registered.accountId);

      setSetup({ status: "running", step: "verify" });
      const info = await getAccountInfo({ apiKey });
      if (!sameKey(info.l2Key, keys.publicKey) || String(info.l2Vault) !== registered.l2Vault) throw new Error("발급된 API 키의 계정 정보가 등록 결과와 달라요.");

      saveAccount({ address, accountId: registered.accountId, vault: registered.l2Vault, starkPublicKey: keys.publicKey, apiKey });
      keyRef.current = { address, privateKey: keys.privateKey };
      setUnlockedFor(address);
      setSetup({ status: "idle" });
    } catch (error) {
      setSetup({ status: "error", message: describeError(error) });
    }
  }, [wallet, address, account, setup.status, setSetup]);

  const signingKey = useCallback(() => (address && keyRef.current?.address === address ? keyRef.current.privateKey : null), [address]);

  const value: WalletContextValue = {
    configured: true,
    ready: ready && walletsReady,
    authenticated,
    wallets,
    address,
    selectAddress,
    login: () => login(),
    connectAnother: () => connectWallet(),
    logout: handleLogout,
    account,
    unlocked,
    setup,
    connectAccount,
    lock,
    signingKey,
    previous,
    dismissPrevious: () => setPrevious(null),
    ...panel,
  };

  return (
    <WalletContext value={value}>
      {children}
      <WalletModal />
    </WalletContext>
  );
}
