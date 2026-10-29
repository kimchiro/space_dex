"use client";

import Link from "next/link";
import styled from "styled-components";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Wrapper>
      <Title>{title}</Title>
      <Desc>{description}</Desc>
      <Back href="/">홈으로 가기</Back>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 480px;
  padding: 32px 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bgSub};
  text-align: center;
  word-break: keep-all;

  @container main (max-width: 480px) {
    min-height: 360px;
  }
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
`;

const Desc = styled.p`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Back = styled(Link)`
  margin-top: 16px;
  padding: 10px 18px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
  font-weight: 600;
`;
