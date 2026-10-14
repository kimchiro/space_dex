"use client";

import Link from "next/link";
import { useState } from "react";
import styled from "styled-components";

const notice = {
  label: "공지",
  message: "10월 20일(화) 02:00~04:00 스마트 컨트랙트 업그레이드로 스왑 및 유동성 공급이 일시 중단돼요.",
  href: "/",
};

export default function NoticeBanner() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <Wrapper>
      <Banner role="status">
        <Badge>{notice.label}</Badge>
        <Message>{notice.message}</Message>
        <More href={notice.href}>자세히 보기</More>
        <Close aria-label="공지 닫기" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Close>
      </Banner>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: 16px 24px 0;
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 8px 0 16px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.primaryWeak};
`;

const Badge = styled.span`
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 12px;
  font-weight: 700;
`;

const Message = styled.p`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const More = styled(Link)`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    text-decoration: underline;
  }
`;

const Close = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textWeak};

  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  &:hover {
    background: rgba(49, 130, 246, 0.12);
    color: ${({ theme }) => theme.colors.text};
  }
`;
