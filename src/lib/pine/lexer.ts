export type TokenType = "num" | "str" | "color" | "id" | "op";
export type Token = { type: TokenType; value: string; line: number; col: number; end: number };

/** 여러 줄에 걸친 하나의 문장. indent는 문장 첫 줄의 들여쓰기(스페이스 수). */
export type LogicalLine = { indent: number; line: number; tokens: Token[] };

const OPERATORS = [":=", "==", "!=", "<=", ">=", "=>", "+=", "-=", "*=", "/=", "+", "-", "*", "/", "%", "<", ">", "=", "?", ":", "(", ")", "[", "]", ",", "."];

export class LexError extends Error {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(message);
  }
}

function tokenizeLine(text: string, line: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }
    if (text.startsWith("//", i)) break;

    const start = i;
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(i))!;
      i += m[0].length;
      tokens.push({ type: "num", value: m[0], line, col: start, end: i });
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      let value = "";
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\" && i + 1 < text.length) {
          value += text[i + 1] === "n" ? "\n" : text[i + 1];
          i += 2;
        } else value += text[i++];
      }
      if (i >= text.length) throw new LexError(line, "문자열 따옴표가 닫히지 않았어요.");
      i++;
      tokens.push({ type: "str", value, line, col: start, end: i });
      continue;
    }
    if (ch === "#") {
      const m = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?/.exec(text.slice(i));
      if (!m) throw new LexError(line, `색상 값 형식이 올바르지 않아요: ${text.slice(i, i + 9)}`);
      i += m[0].length;
      tokens.push({ type: "color", value: m[0], line, col: start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))!;
      i += m[0].length;
      tokens.push({ type: "id", value: m[0], line, col: start, end: i });
      continue;
    }
    const op = OPERATORS.find((o) => text.startsWith(o, i));
    if (!op) throw new LexError(line, `알 수 없는 문자 '${ch}'`);
    i += op.length;
    tokens.push({ type: "op", value: op, line, col: start, end: i });
  }
  return tokens;
}

const indentOf = (text: string) => {
  let n = 0;
  for (const ch of text) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
};

/**
 * 줄 단위로 토큰을 만든 뒤 Pine 규칙에 맞춰 문장으로 묶는다.
 * 괄호가 열려 있거나, 들여쓰기가 4의 배수가 아닌 줄은 앞 문장에 이어지는 줄로 본다.
 */
export function lex(source: string): { lines: LogicalLine[]; errors: LexError[] } {
  const lines: LogicalLine[] = [];
  const errors: LexError[] = [];
  let current: LogicalLine | null = null;
  let depth = 0;

  source.split("\n").forEach((text, index) => {
    const lineNo = index + 1;
    let tokens: Token[];
    try {
      tokens = tokenizeLine(text, lineNo);
    } catch (error) {
      if (error instanceof LexError) errors.push(error);
      return;
    }
    if (tokens.length === 0) return;

    const indent = indentOf(text);
    const continues = current && (depth > 0 || (indent % 4 !== 0 && indent > current.indent));
    if (continues && current) {
      current.tokens.push(...tokens);
    } else {
      current = { indent, line: lineNo, tokens };
      lines.push(current);
      depth = 0;
    }
    for (const t of tokens) {
      if (t.type !== "op") continue;
      if (t.value === "(" || t.value === "[") depth++;
      if (t.value === ")" || t.value === "]") depth = Math.max(0, depth - 1);
    }
  });

  return { lines, errors };
}
