"use client";

import { useEffect, useEffectEvent, useState } from "react";
import styled from "styled-components";
import { MenuDivider, MenuItem, MenuLabel } from "./Dropdown";
import { LinkIcon, MailIcon, MessageIcon, SendIcon, ShareIcon } from "./icons";

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
/** 카카오 JS 키는 브라우저에서 쓰도록 만든 공개 키라 NEXT_PUBLIC으로 둔다. 카카오 개발자 콘솔에 사이트 도메인을 등록해야 동작한다. */
const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (settings: object) => void };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let kakaoLoading: Promise<KakaoSdk | null> | null = null;

function loadKakao(key: string) {
  kakaoLoading ??= new Promise((resolve) => {
    const ready = () => {
      const kakao = window.Kakao ?? null;
      if (kakao && !kakao.isInitialized()) kakao.init(key);
      resolve(kakao);
    };
    if (window.Kakao) return ready();
    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = ready;
    script.onerror = () => {
      kakaoLoading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return kakaoLoading;
}

function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",");
  const type = head.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

export type SharePayload = {
  heading: string;
  title: string;
  text: string;
  /** 사이트 안의 경로. 공유할 때 현재 도메인을 붙여 전체 주소로 만든다. */
  path: string;
  fileName: string;
  /** 차트 캔버스를 PNG data URL로 돌려준다. */
  image: () => string | null;
};

/**
 * 공유 메뉴 본문. 기기 공유(navigator.share)는 사용자 클릭 직후에만 허용되므로,
 * 이미지 변환·카카오 SDK 로드처럼 시간이 걸리는 작업은 클릭 전에 끝내 두거나 동기로 처리한다.
 */
export default function ShareMenu({ payload, onDone }: { payload: SharePayload; onDone: () => void }) {
  const [kakao, setKakao] = useState<KakaoSdk | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const url = new URL(payload.path, window.location.origin).toString();
  const canNativeShare = typeof navigator.share === "function";
  const message = `${payload.text}\n${url}`;

  useEffect(() => {
    if (!KAKAO_KEY) return;
    let alive = true;
    loadKakao(KAKAO_KEY).then((k) => alive && setKakao(k));
    return () => {
      alive = false;
    };
  }, []);

  const closeAfterNotice = useEffectEvent(onDone);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(closeAfterNotice, 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  const copyLink = async (done: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setNotice(done);
    } catch {
      setNotice("복사하지 못했어요. 주소창의 링크를 직접 복사해 주세요.");
    }
  };

  const nativeShare = async (data: ShareData) => {
    try {
      await navigator.share(data);
    } catch {
      // 사용자가 공유 시트를 닫은 경우도 여기로 온다.
    }
    onDone();
  };

  const openWindow = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    onDone();
  };

  const openApp = (href: string) => {
    window.location.href = href;
    onDone();
  };

  const shareKakao = () => {
    if (kakao) {
      kakao.Share.sendDefault({
        objectType: "text",
        text: payload.text,
        link: { webUrl: url, mobileWebUrl: url },
        buttonTitle: "차트 보기",
      });
      onDone();
    } else if (canNativeShare) {
      nativeShare({ title: payload.title, text: payload.text, url });
    } else {
      copyLink("링크를 복사했어요. 카카오톡 대화방에 붙여넣어 주세요.");
    }
  };

  const shareImage = () => {
    const dataUrl = payload.image();
    const file = dataUrl ? new File([dataUrlToBlob(dataUrl)], `${payload.fileName}.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare?.({ files: [file] })) nativeShare({ files: [file], title: payload.title, text: message });
    else nativeShare({ title: payload.title, text: payload.text, url });
  };

  const encoded = { url: encodeURIComponent(url), text: encodeURIComponent(payload.text), message: encodeURIComponent(message) };

  return (
    <>
      <MenuLabel>{payload.heading}</MenuLabel>
      <MenuItem type="button" onClick={shareKakao}>
        <Badge $bg="#FEE500" $fg="#191919">
          <MessageIcon size={14} />
        </Badge>
        카카오톡
      </MenuItem>
      <MenuItem type="button" onClick={() => openWindow(`https://t.me/share/url?url=${encoded.url}&text=${encoded.text}`)}>
        <Badge $bg="#229ED9">
          <SendIcon size={14} />
        </Badge>
        텔레그램
      </MenuItem>
      <MenuItem type="button" onClick={() => openApp(`sms:?&body=${encoded.message}`)}>
        <Badge $bg="#34C759">
          <MessageIcon size={14} />
        </Badge>
        문자 메시지
      </MenuItem>
      <MenuItem type="button" onClick={() => openApp(`mailto:?subject=${encodeURIComponent(payload.title)}&body=${encoded.message}`)}>
        <Badge $bg="#6B7684">
          <MailIcon size={14} />
        </Badge>
        이메일
      </MenuItem>
      <MenuDivider />
      <MenuItem type="button" onClick={() => copyLink("링크를 복사했어요.")}>
        <Badge $bg="transparent" $fg="currentColor">
          <LinkIcon size={16} />
        </Badge>
        링크 복사
      </MenuItem>
      {canNativeShare && (
        <MenuItem type="button" onClick={shareImage}>
          <Badge $bg="transparent" $fg="currentColor">
            <ShareIcon size={16} />
          </Badge>
          차트 이미지로 공유
        </MenuItem>
      )}
      {notice && <Notice role="status">{notice}</Notice>}
    </>
  );
}

const Badge = styled.span<{ $bg: string; $fg?: string }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ $bg }) => $bg};
  color: ${({ $fg }) => $fg ?? "#fff"};
`;

const Notice = styled.p`
  max-width: 220px;
  margin: 6px 4px 2px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primaryWeak};
`;
