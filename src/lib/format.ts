export function formatPrice(value: number) {
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
}

export function formatCompact(value: number) {
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatAmount(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
