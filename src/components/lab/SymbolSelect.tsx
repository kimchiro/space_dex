"use client";

import { useMarket } from "@/components/providers/MarketProvider";
import { Select } from "./ui";

export default function SymbolSelect({ value, onChange, ariaLabel = "종목" }: { value: string; onChange: (symbol: string) => void; ariaLabel?: string }) {
  const { tokens } = useMarket();
  const symbols = tokens.some((t) => t.symbol === value) ? tokens : [{ symbol: value, name: value }, ...tokens];

  return (
    <Select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {symbols.map((t) => (
        <option key={t.symbol} value={t.symbol}>
          {t.symbol} · {t.name}
        </option>
      ))}
    </Select>
  );
}
