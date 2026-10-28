import type { Token } from "@/data/tokens";

const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** "비트코인" → "ㅂㅌㅋㅇ". 한글 음절이 아닌 글자는 그대로 둔다. */
function toChoseong(text: string) {
  return Array.from(text, (ch) => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : ch;
  }).join("");
}

const isChoseongOnly = (text: string) => /^[ㄱ-ㅎ]+$/.test(text);

/** 낮을수록 위에 노출. 일치하지 않으면 null. */
function matchScore(token: Token, query: string) {
  const q = query.toLowerCase();
  const symbol = token.symbol.toLowerCase();
  const name = token.name.toLowerCase();
  const englishName = (token.id ?? "").replace(/-/g, " ");

  if (symbol === q) return 0;
  if (symbol.startsWith(q)) return 1;
  if (name.startsWith(q) || englishName.startsWith(q)) return 2;
  if (name.includes(q) || englishName.includes(q) || symbol.includes(q)) return 3;
  if (isChoseongOnly(q) && toChoseong(token.name).includes(q)) return 4;
  return null;
}

/** 심볼·한글 이름·영문 id·초성으로 찾는다. */
export function searchTokens(tokens: Token[], query: string, limit = Infinity) {
  return tokens
    .map((token, index) => ({ token, index, score: matchScore(token, query) }))
    .filter((r): r is { token: Token; index: number; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.token);
}
