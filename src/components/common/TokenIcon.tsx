"use client";

import Image from "next/image";
import { useState } from "react";
import styled from "styled-components";

type Props = {
  symbol: string;
  color: string;
  image?: string;
  size?: number;
};

export default function TokenIcon({ symbol, color, image, size = 36 }: Props) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <Icon
        src={image}
        alt=""
        width={size}
        height={size}
        $size={size}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Circle $color={color} $size={size} aria-hidden>
      {symbol.slice(0, 1)}
    </Circle>
  );
}

const Icon = styled(Image)<{ $size: number }>`
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  object-fit: cover;
`;

const Circle = styled.span<{ $color: string; $size: number }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: ${({ $size }) => Math.round($size * 0.42)}px;
  font-weight: 700;
`;
