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

const kstFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** now가 0이면(서버 렌더링 중) 한국 시간 기준 절대 시각을 반환한다. */
export function formatRelativeTime(iso: string, now: number) {
  const time = new Date(iso).getTime();
  if (!now) return kstFormatter.format(time);

  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatAmount(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
