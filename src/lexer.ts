// tak lexer — source string → token stream

export type TokenKind =
  | 'NUMBER'
  | 'STRING'
  | 'BOOL'
  | 'NULL'
  | 'IDENT'
  | 'LBRACKET'    // [
  | 'RBRACKET'    // ]
  | 'LBRACE'      // {
  | 'RBRACE'      // }
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'COLON'       // :
  | 'DASHDASH'    // --
  | 'FN'          // fn keyword
  | 'USE'         // use keyword
  | 'AS'          // as keyword (only valid in use binding lists)
  | 'JS_EXPR'     // @js(...)
  | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string | number | boolean | null;
  /** Raw source text for this token */
  raw: string;
  line: number;
  col: number;
}

export class LexError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(`[LexError] ${message} at ${line}:${col}`);
    this.name = 'LexError';
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0): string {
    return source[pos + offset] ?? '';
  }

  function advance(): string {
    const ch = source[pos++];
    if (ch === '\n') { line++; col = 1; } else { col++; }
    return ch;
  }

  function skipWhitespace() {
    while (pos < source.length) {
      const ch = peek();
      if (ch === '/' && peek(1) === '/') {
        // line comment — consume to end of line
        while (pos < source.length && peek() !== '\n') advance();
      } else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        advance();
      } else {
        break;
      }
    }
  }

  function makeToken(kind: TokenKind, raw: string, value: Token['value'], l: number, c: number): Token {
    return { kind, value, raw, line: l, col: c };
  }

  while (pos < source.length) {
    skipWhitespace();
    if (pos >= source.length) break;

    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Single-char tokens
    if (ch === '[') { advance(); tokens.push(makeToken('LBRACKET', '[', '[', startLine, startCol)); continue; }
    if (ch === ']') { advance(); tokens.push(makeToken('RBRACKET', ']', ']', startLine, startCol)); continue; }
    if (ch === '{') { advance(); tokens.push(makeToken('LBRACE', '{', '{', startLine, startCol)); continue; }
    if (ch === '}') { advance(); tokens.push(makeToken('RBRACE', '}', '}', startLine, startCol)); continue; }
    if (ch === '(') { advance(); tokens.push(makeToken('LPAREN', '(', '(', startLine, startCol)); continue; }
    if (ch === ')') { advance(); tokens.push(makeToken('RPAREN', ')', ')', startLine, startCol)); continue; }
    if (ch === ':') { advance(); tokens.push(makeToken('COLON', ':', ':', startLine, startCol)); continue; }

    // -- (double dash)
    if (ch === '-' && peek(1) === '-') {
      advance(); advance();
      tokens.push(makeToken('DASHDASH', '--', '--', startLine, startCol));
      continue;
    }

    // String literal "..."
    if (ch === '"') {
      advance(); // consume opening "
      let str = '';
      while (pos < source.length && peek() !== '"') {
        const c = advance();
        if (c === '\\') {
          const esc = advance();
          switch (esc) {
            case 'n':  str += '\n'; break;
            case 't':  str += '\t'; break;
            case 'r':  str += '\r'; break;
            case '"':  str += '"'; break;
            case '\\': str += '\\'; break;
            default: str += '\\' + esc;
          }
        } else {
          str += c;
        }
      }
      if (pos >= source.length) throw new LexError('Unterminated string', startLine, startCol);
      advance(); // consume closing "
      tokens.push(makeToken('STRING', `"${str}"`, str, startLine, startCol));
      continue;
    }

    // @js(...) expression
    if (ch === '@' && source.slice(pos, pos + 3) === '@js') {
      pos += 3; col += 3;
      if (peek() !== '(') throw new LexError('Expected ( after @js', startLine, startCol);
      advance(); // consume (
      let depth = 1;
      let jsExpr = '';
      let inStr = false;
      let strChar = '';
      while (pos < source.length && depth > 0) {
        const c = advance();
        if (inStr) {
          jsExpr += c;
          if (c === '\\' && pos < source.length) {
            jsExpr += advance(); // consume escaped char verbatim
          } else if (c === strChar) {
            inStr = false;
          }
        } else if (c === '"' || c === "'") {
          inStr = true;
          strChar = c;
          jsExpr += c;
        } else if (c === '(') {
          depth++;
          jsExpr += c;
        } else if (c === ')') {
          depth--;
          if (depth === 0) break; // closing ) not added to jsExpr
          jsExpr += c;
        } else {
          jsExpr += c;
        }
      }
      if (depth !== 0) throw new LexError('Unterminated @js(...)', startLine, startCol);
      tokens.push(makeToken('JS_EXPR', `@js(${jsExpr})`, jsExpr, startLine, startCol));
      continue;
    }

    // Number: integers and floats (including negative via unary minus handled at parse)
    if ((ch >= '0' && ch <= '9') || (ch === '-' && peek(1) >= '0' && peek(1) <= '9' && (tokens.length === 0 || isNotValueToken(tokens[tokens.length - 1])))) {
      let numStr = '';
      if (ch === '-') { numStr += advance(); }
      while (pos < source.length && peek() >= '0' && peek() <= '9') numStr += advance();
      if (peek() === '.' && peek(1) >= '0' && peek(1) <= '9') {
        numStr += advance(); // consume '.'
        while (pos < source.length && peek() >= '0' && peek() <= '9') numStr += advance();
      }
      const num = parseFloat(numStr);
      tokens.push(makeToken('NUMBER', numStr, num, startLine, startCol));
      continue;
    }

    // Identifiers, keywords, and operator words
    // Allow a wide set of identifier chars including /, *, -, +, !, =, <, >, ?, %
    if (isIdentStart(ch)) {
      let ident = '';
      while (pos < source.length && isIdentCont(peek())) ident += advance();

      // Keywords
      if (ident === 'fn') { tokens.push(makeToken('FN', ident, 'fn', startLine, startCol)); continue; }
      if (ident === 'use') { tokens.push(makeToken('USE', ident, 'use', startLine, startCol)); continue; }
      if (ident === 'as') { tokens.push(makeToken('AS', ident, 'as', startLine, startCol)); continue; }
      if (ident === 'true') { tokens.push(makeToken('BOOL', ident, true, startLine, startCol)); continue; }
      if (ident === 'false') { tokens.push(makeToken('BOOL', ident, false, startLine, startCol)); continue; }
      if (ident === 'null') { tokens.push(makeToken('NULL', ident, null, startLine, startCol)); continue; }

      tokens.push(makeToken('IDENT', ident, ident, startLine, startCol));
      continue;
    }

    // Operator-only tokens that aren't part of identifiers above
    if (isOperatorChar(ch)) {
      let op = '';
      while (pos < source.length && isOperatorChar(peek())) op += advance();
      // re-check for -- (already handled above) and - (as negative num prefix)
      tokens.push(makeToken('IDENT', op, op, startLine, startCol));
      continue;
    }

    throw new LexError(`Unexpected character: ${JSON.stringify(ch)}`, startLine, startCol);
  }

  tokens.push(makeToken('EOF', '', null, line, col));
  return tokens;
}

function isNotValueToken(t: Token): boolean {
  // Returns true if the previous token means the '-' is likely unary (start of negative number)
  return t.kind === 'LBRACKET' || t.kind === 'LPAREN' || t.kind === 'LBRACE' || t.kind === 'DASHDASH' || t.kind === 'FN';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '.' || ch === '/';
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9') || ch === '-' || ch === '?' || ch === '!' || ch === '\'';
}

function isOperatorChar(ch: string): boolean {
  return ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '=' ||
         ch === '<' || ch === '>' || ch === '!' || ch === '&' || ch === '|' ||
         ch === '^' || ch === '~' || ch === '#';
}
