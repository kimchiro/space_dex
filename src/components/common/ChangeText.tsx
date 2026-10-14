"use client";

import styled from "styled-components";
import { formatPercent } from "@/lib/format";

type Props = {
  value: number;
  size?: number;
};

export default function ChangeText({ value, size = 15 }: Props) {
  return (
    <Text $value={value} $size={size}>
      {formatPercent(value)}
    </Text>
  );
}

const Text = styled.span<{ $value: number; $size: number }>`
  font-size: ${({ $size }) => $size}px;
  font-weight: 500;
  color: ${({ theme, $value }) =>
    $value > 0 ? theme.colors.rise : $value < 0 ? theme.colors.fall : theme.colors.textWeak};
`;
