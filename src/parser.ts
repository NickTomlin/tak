// tak parser — token stream → AST

import { Token, TokenKind } from './lexer.js';
import {
  AstNode, Program, FnDef, Quotation, DictLiteral, Literal, Word, JsExpr,
  StackEffect, DictEntry, Use, UseBinding,
} from './ast.js';

export class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`[ParseError] ${message} at ${line}:${col}`);
    this.name = 'ParseError';
  }
}

export function parse(tokens: Token[]): Program {
  let pos = 0;

  function peek(): Token {
    return tokens[pos] ?? tokens[tokens.length - 1]; // EOF guard
  }

  function advance(): Token {
    const t = tokens[pos];
    if (pos < tokens.length - 1) pos++;
    return t;
  }

  function expect(kind: TokenKind): Token {
    const t = peek();
    if (t.kind !== kind) {
      throw new ParseError(`Expected ${kind} but got ${t.kind} (${String(t.raw)})`, t.line, t.col);
    }
    return advance();
  }

  function at(kind: TokenKind): boolean {
    return peek().kind === kind;
  }

  /** Parse a single expression */
  function parseExpr(): AstNode {
    const t = peek();

    // Literal: number, string, bool, null
    if (t.kind === 'NUMBER') {
      advance();
      return { type: 'Literal', value: t.value as number, line: t.line, col: t.col } satisfies Literal;
    }
    if (t.kind === 'STRING') {
      advance();
      // Static import: "url" use  or  "url" [ bindings ] use
      if (at('USE')) {
        advance(); // consume use
        return { type: 'Use', url: t.value as string, bindings: null, line: t.line, col: t.col } satisfies Use;
      }
      if (at('LBRACKET') && isUseBindingList()) {
        const bindings = parseUseBindings();
        expect('USE');
        return { type: 'Use', url: t.value as string, bindings, line: t.line, col: t.col } satisfies Use;
      }
      return { type: 'Literal', value: t.value as string, line: t.line, col: t.col } satisfies Literal;
    }
    if (t.kind === 'BOOL') {
      advance();
      return { type: 'Literal', value: t.value as boolean, line: t.line, col: t.col } satisfies Literal;
    }
    if (t.kind === 'NULL') {
      advance();
      return { type: 'Literal', value: null, line: t.line, col: t.col } satisfies Literal;
    }

    // Quotation: [ ... ]
    if (t.kind === 'LBRACKET') {
      advance(); // consume [
      const body: AstNode[] = [];
      while (!at('RBRACKET') && !at('EOF')) {
        body.push(parseExpr());
      }
      expect('RBRACKET');
      return { type: 'Quotation', body, line: t.line, col: t.col } satisfies Quotation;
    }

    // Dict literal: { key: value, ... }
    // Note: { } inside fn bodies are parsed separately — dict literals have key: value pairs
    if (t.kind === 'LBRACE') {
      // Look-ahead: is this a dict literal (has IDENT COLON) or a fn body?
      // Dict literal detection: after { the first thing is an IDENT followed by COLON
      if (isDictLiteral()) {
        return parseDictLiteral();
      }
      // Otherwise it's an error at this level — fn bodies are parsed in parseFnDef
      throw new ParseError('Unexpected { — use [ ] for quotations at expression level', t.line, t.col);
    }

    // @js(...)
    if (t.kind === 'JS_EXPR') {
      advance();
      return { type: 'JsExpr', expr: t.value as string, line: t.line, col: t.col } satisfies JsExpr;
    }

    // fn definition
    if (t.kind === 'FN') {
      return parseFnDef();
    }

    // Word (identifier / operator)
    if (t.kind === 'IDENT') {
      advance();
      return { type: 'Word', name: t.value as string, line: t.line, col: t.col } satisfies Word;
    }

    throw new ParseError(`Unexpected token: ${t.kind} (${String(t.raw)})`, t.line, t.col);
  }

  /** Scan ahead from current LBRACKET to see if it's a use binding list followed by USE */
  function isUseBindingList(): boolean {
    const saved = pos;
    pos++; // skip [
    while (pos < tokens.length) {
      const tk = tokens[pos];
      if (tk.kind === 'RBRACKET') break;
      if (tk.kind === 'IDENT' || tk.kind === 'AS') { pos++; continue; }
      pos = saved;
      return false;
    }
    if (tokens[pos]?.kind !== 'RBRACKET') { pos = saved; return false; }
    pos++; // skip ]
    const result = tokens[pos]?.kind === 'USE';
    pos = saved;
    return result;
  }

  function parseUseBindings(): UseBinding[] {
    expect('LBRACKET');
    const bindings: UseBinding[] = [];
    while (!at('RBRACKET') && !at('EOF')) {
      const nameTok = expect('IDENT');
      const name = nameTok.value as string;
      if (at('AS')) {
        advance(); // consume as
        const aliasTok = expect('IDENT');
        bindings.push({ name, alias: aliasTok.value as string });
      } else {
        bindings.push({ name, alias: name });
      }
    }
    expect('RBRACKET');
    return bindings;
  }

  function isDictLiteral(): boolean {
    // Peek ahead: after '{' is there IDENT ':' ?
    const saved = pos;
    pos++; // skip {
    const isDict = peek().kind === 'IDENT' && tokens[pos + 1]?.kind === 'COLON';
    pos = saved;
    return isDict || (tokens[pos + 1]?.kind === 'RBRACE'); // {} empty dict
  }

  function parseDictLiteral(): DictLiteral {
    const startTok = peek();
    expect('LBRACE');
    const entries: DictEntry[] = [];

    while (!at('RBRACE') && !at('EOF')) {
      const keyTok = expect('IDENT');
      expect('COLON');
      const value = parseExpr();
      entries.push({ key: keyTok.value as string, value });

      // Optional comma
      if (at('IDENT') && peek().raw === ',') advance();
    }

    expect('RBRACE');
    return { type: 'DictLiteral', entries, line: startTok.line, col: startTok.col };
  }

  function parseFnDef(): FnDef {
    const fnTok = expect('FN');
    const nameTok = expect('IDENT');

    // Stack effect: ( inputs -- outputs )
    expect('LPAREN');
    const inputs: string[] = [];
    while (!at('DASHDASH') && !at('RPAREN') && !at('EOF')) {
      inputs.push(expect('IDENT').value as string);
    }
    expect('DASHDASH');
    const outputs: string[] = [];
    while (!at('RPAREN') && !at('EOF')) {
      outputs.push(expect('IDENT').value as string);
    }
    expect('RPAREN');

    const effect: StackEffect = { inputs, outputs };

    // Body: { expr* }
    expect('LBRACE');
    const body: AstNode[] = [];
    while (!at('RBRACE') && !at('EOF')) {
      body.push(parseExpr());
    }
    expect('RBRACE');

    return {
      type: 'FnDef',
      name: nameTok.value as string,
      effect,
      body,
      line: fnTok.line,
      col: fnTok.col,
    };
  }

  // Parse top-level program
  const body: AstNode[] = [];
  while (!at('EOF')) {
    body.push(parseExpr());
  }

  return { type: 'Program', body };
}
