import type { Diagnostic, Expr, Program, Stmt } from "./ast";
import type { LogicalLine, Token } from "./lexer";

export class ParseError extends Error {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(message);
  }
}

const TYPE_KEYWORDS = new Set(["int", "float", "bool", "string", "color", "series", "simple", "const", "input", "line", "label", "box", "table"]);
const QUALIFIERS = new Set(["series", "simple", "const"]);

const UNSUPPORTED_BLOCKS: Record<string, string> = {
  for: "for 반복문은 아직 지원하지 않아요. 같은 계산을 ta.* 함수로 바꿀 수 있는지 확인해 주세요.",
  while: "while 반복문은 아직 지원하지 않아요.",
  switch: "switch 문은 아직 지원하지 않아요. if / else if로 바꿔 주세요.",
  type: "사용자 정의 타입(type)은 아직 지원하지 않아요.",
  method: "method 정의는 아직 지원하지 않아요.",
  import: "라이브러리 import는 지원하지 않아요. 필요한 코드를 직접 붙여 넣어 주세요.",
  export: "라이브러리 export는 지원하지 않아요.",
};

class ExprParser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly line: number,
    private readonly nextId: () => number,
  ) {}

  get done() {
    return this.pos >= this.tokens.length;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  isOp(value: string, offset = 0) {
    const t = this.peek(offset);
    return t?.type === "op" && t.value === value;
  }

  isId(value?: string, offset = 0) {
    const t = this.peek(offset);
    return t?.type === "id" && (value === undefined || t.value === value);
  }

  next() {
    const t = this.tokens[this.pos++];
    if (!t) throw new ParseError(this.line, "문장이 중간에 끝났어요.");
    return t;
  }

  expectOp(value: string) {
    const t = this.next();
    if (t.type !== "op" || t.value !== value) throw new ParseError(t.line, `'${value}'가 필요한 위치에 '${t.value}'가 있어요.`);
  }

  expectEnd() {
    const t = this.peek();
    if (t) throw new ParseError(t.line, `'${t.value}' 이후의 내용을 해석하지 못했어요.`);
  }

  parseExpr(): Expr {
    return this.ternary();
  }

  private ternary(): Expr {
    const c = this.or();
    if (this.isOp("?")) {
      this.next();
      const a = this.ternary();
      this.expectOp(":");
      const b = this.ternary();
      return { k: "tern", c, a, b };
    }
    return c;
  }

  private or(): Expr {
    let l = this.and();
    while (this.isId("or")) {
      this.next();
      l = { k: "bin", op: "or", l, r: this.and() };
    }
    return l;
  }

  private and(): Expr {
    let l = this.equality();
    while (this.isId("and")) {
      this.next();
      l = { k: "bin", op: "and", l, r: this.equality() };
    }
    return l;
  }

  private equality(): Expr {
    let l = this.comparison();
    while (this.isOp("==") || this.isOp("!=")) {
      const op = this.next().value;
      l = { k: "bin", op, l, r: this.comparison() };
    }
    return l;
  }

  private comparison(): Expr {
    let l = this.additive();
    while (this.isOp("<") || this.isOp(">") || this.isOp("<=") || this.isOp(">=")) {
      const op = this.next().value;
      l = { k: "bin", op, l, r: this.additive() };
    }
    return l;
  }

  private additive(): Expr {
    let l = this.multiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value;
      l = { k: "bin", op, l, r: this.multiplicative() };
    }
    return l;
  }

  private multiplicative(): Expr {
    let l = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next().value;
      l = { k: "bin", op, l, r: this.unary() };
    }
    return l;
  }

  private unary(): Expr {
    if (this.isOp("-") || this.isOp("+")) {
      const op = this.next().value as "-" | "+";
      return { k: "un", op, e: this.unary() };
    }
    if (this.isId("not")) {
      this.next();
      return { k: "un", op: "not", e: this.unary() };
    }
    return this.postfix();
  }

  private postfix(): Expr {
    let e = this.primary();
    while (this.isOp("[")) {
      const t = this.next();
      const offset = this.parseExpr();
      this.expectOp("]");
      e = { k: "hist", id: this.nextId(), e, offset, line: t.line };
    }
    return e;
  }

  private primary(): Expr {
    const t = this.next();
    if (t.type === "num") return { k: "num", v: Number(t.value) };
    if (t.type === "str" || t.type === "color") return { k: "str", v: t.value };
    if (t.type === "op" && t.value === "(") {
      const e = this.parseExpr();
      this.expectOp(")");
      return e;
    }
    if (t.type === "id") {
      if (t.value === "true" || t.value === "false") return { k: "bool", v: t.value === "true" };
      if (t.value === "na" && !this.isOp("(")) return { k: "na" };
      let name = t.value;
      while (this.isOp(".") && this.isId(undefined, 1)) {
        this.next();
        name += `.${this.next().value}`;
      }
      if (this.isOp("(")) return this.call(name, t.line);
      return { k: "id", name, line: t.line };
    }
    throw new ParseError(t.line, `'${t.value}'를 여기에 쓸 수 없어요.`);
  }

  private call(name: string, line: number): Expr {
    this.expectOp("(");
    const args: Expr[] = [];
    const named: Record<string, Expr> = {};
    while (!this.isOp(")")) {
      if (this.isId() && this.isOp("=", 1)) {
        const key = this.next().value;
        this.next();
        named[key] = this.parseExpr();
      } else {
        if (Object.keys(named).length > 0) throw new ParseError(line, `${name}: 이름 붙인 인자 뒤에 순서 인자를 쓸 수 없어요.`);
        args.push(this.parseExpr());
      }
      if (this.isOp(",")) this.next();
      else break;
    }
    this.expectOp(")");
    return { k: "call", id: this.nextId(), name, args, named, line };
  }
}

/** 들여쓰기 블록 구조를 따라 문장 목록으로 바꾼다. 해석에 실패한 줄은 진단에 남기고 건너뛴다. */
export function parse(lines: LogicalLine[]): { program: Program; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  let idCounter = 0;
  const nextId = () => ++idCounter;
  let index = 0;

  const skipBody = (indent: number) => {
    while (index < lines.length && lines[index].indent > indent) index++;
  };

  const parseBlock = (indent: number): Stmt[] => {
    const stmts: Stmt[] = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent < indent) break;
      if (line.indent > indent) {
        diagnostics.push({ line: line.line, severity: "error", message: "들여쓰기가 예상과 달라요. if 블록 안쪽은 4칸 들여써 주세요." });
        index++;
        continue;
      }
      const first = line.tokens[0];
      if (first.type === "id" && first.value === "else") {
        diagnostics.push({ line: line.line, severity: "error", message: "짝이 맞는 if 없이 else가 나왔어요." });
        index++;
        skipBody(line.indent);
        continue;
      }
      const at = index;
      try {
        const stmt = parseStatement(line);
        if (stmt) stmts.push(stmt);
      } catch (error) {
        if (!(error instanceof ParseError)) throw error;
        diagnostics.push({ line: error.line, severity: "error", message: error.message });
        if (index === at) index++;
        skipBody(line.indent);
      }
    }
    return stmts;
  };

  const parseIf = (tokens: Token[], line: LogicalLine): Stmt => {
    const p = new ExprParser(tokens, line.line, nextId);
    p.next();
    const cond = p.parseExpr();
    p.expectEnd();
    index++;
    const bodyIndent = lines[index]?.indent ?? 0;
    if (index >= lines.length || bodyIndent <= line.indent) throw new ParseError(line.line, "if 다음 줄에 들여쓴 실행 블록이 필요해요.");
    const thenBlock = parseBlock(bodyIndent);

    let elseBlock: Stmt[] = [];
    const next = lines[index];
    if (next && next.indent === line.indent && next.tokens[0].type === "id" && next.tokens[0].value === "else") {
      if (next.tokens[1]?.type === "id" && next.tokens[1].value === "if") {
        elseBlock = [parseIf(next.tokens.slice(1), next)];
      } else {
        if (next.tokens.length > 1) throw new ParseError(next.line, "else 뒤에는 줄을 바꿔 블록을 써 주세요.");
        index++;
        const elseIndent = lines[index]?.indent ?? 0;
        if (index >= lines.length || elseIndent <= line.indent) throw new ParseError(next.line, "else 다음 줄에 들여쓴 실행 블록이 필요해요.");
        elseBlock = parseBlock(elseIndent);
      }
    }
    return { t: "if", cond, then: thenBlock, else: elseBlock, line: line.line };
  };

  const parseStatement = (line: LogicalLine): Stmt | null => {
    const tokens = line.tokens;
    const first = tokens[0];

    if (first.type === "id" && first.value === "if") return parseIf(tokens, line);

    if (first.type === "id" && UNSUPPORTED_BLOCKS[first.value]) {
      throw new ParseError(line.line, UNSUPPORTED_BLOCKS[first.value]);
    }

    const arrowIndex = tokens.findIndex((t) => t.type === "op" && t.value === "=>");
    if (arrowIndex > 0) {
      throw new ParseError(line.line, `사용자 정의 함수(${first.value})는 아직 지원하지 않아요. 함수 내용을 본문에 풀어 써 주세요.`);
    }

    index++;
    const p = new ExprParser(tokens, line.line, nextId);

    if (p.isOp("[")) {
      p.next();
      const names: string[] = [];
      while (!p.isOp("]")) {
        const t = p.next();
        if (t.type !== "id") throw new ParseError(line.line, "[a, b] = ... 형태의 변수 이름이 필요해요.");
        names.push(t.value);
        if (p.isOp(",")) p.next();
      }
      p.expectOp("]");
      p.expectOp("=");
      const e = p.parseExpr();
      p.expectEnd();
      return { t: "tuple", names, e, line: line.line };
    }

    let mode: "decl" | "var" | null = null;
    if (p.isId("var") || p.isId("varip")) {
      p.next();
      mode = "var";
    }
    while (p.isId() && TYPE_KEYWORDS.has(p.peek()!.value) && p.isId(undefined, 1) && !p.isOp(".", 1)) {
      if (QUALIFIERS.has(p.peek()!.value) || p.isId(undefined, 1)) p.next();
      else break;
    }

    if (p.isId() && p.isOp("=", 1)) {
      const name = p.next().value;
      p.next();
      const e = p.parseExpr();
      p.expectEnd();
      return { t: "assign", mode: mode ?? "decl", name, e, line: line.line };
    }
    if (mode) throw new ParseError(line.line, "var 다음에는 '이름 = 값' 형태가 필요해요.");

    if (p.isId() && p.peek(1)?.type === "op" && [":=", "+=", "-=", "*=", "/="].includes(p.peek(1)!.value)) {
      const name = p.next().value;
      const op = p.next().value;
      const rhs = p.parseExpr();
      p.expectEnd();
      const e: Expr = op === ":=" ? rhs : { k: "bin", op: op[0], l: { k: "id", name, line: line.line }, r: rhs };
      return { t: "assign", mode: "reassign", name, e, line: line.line };
    }

    const e = p.parseExpr();
    p.expectEnd();
    return { t: "expr", e, line: line.line };
  };

  const program = parseBlock(lines[0]?.indent ?? 0);
  return { program, diagnostics };
}
