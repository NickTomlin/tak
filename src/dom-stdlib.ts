// tak DOM standard library — registerDomStdlib(interp)

import { TakInterpreter, TakValue, TakQuot, TakError } from './interpreter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertString(v: TakValue, word: string): string {
  if (typeof v !== 'string') throw new TakError(`${word}: expected string, got ${typeof v}`);
  return v;
}

function assertElement(v: TakValue, word: string): Element {
  if (!(v instanceof Element)) throw new TakError(`${word}: expected element, got ${typeof v}`);
  return v;
}

function assertQuot(v: TakValue, word: string): TakQuot {
  if (typeof v !== 'object' || v === null || (v as TakQuot).kind !== 'quot') {
    throw new TakError(`${word}: expected quotation`);
  }
  return v as TakQuot;
}

// ---------------------------------------------------------------------------
// registerDomStdlib
// ---------------------------------------------------------------------------

export function registerDomStdlib(interp: TakInterpreter): void {

  // dom/query ( selector -- el|null )
  interp.defineWord('dom/query', i => {
    const sel = assertString(i.pop(), 'dom/query');
    const el = document.querySelector(sel);
    i.push(el as TakValue);
  });

  // dom/query-all ( selector -- arr )
  interp.defineWord('dom/query-all', i => {
    const sel = assertString(i.pop(), 'dom/query-all');
    const els = Array.from(document.querySelectorAll(sel)) as TakValue[];
    i.push({ kind: 'array', items: els });
  });

  // dom/create ( tag -- el )
  interp.defineWord('dom/create', i => {
    const tag = assertString(i.pop(), 'dom/create');
    const el = document.createElement(tag);
    i.push(el as TakValue);
  });

  // dom/append ( parent child -- parent )
  interp.defineWord('dom/append', i => {
    const child = assertElement(i.pop(), 'dom/append');
    const parent = assertElement(i.pop(), 'dom/append');
    parent.appendChild(child);
    i.push(parent as TakValue);
  });

  // dom/text ( el str -- el )
  interp.defineWord('dom/text', i => {
    const text = assertString(i.pop(), 'dom/text');
    const el = assertElement(i.pop(), 'dom/text');
    el.textContent = text;
    i.push(el as TakValue);
  });

  // dom/html ( el str -- el )
  interp.defineWord('dom/html', i => {
    const html = assertString(i.pop(), 'dom/html');
    const el = assertElement(i.pop(), 'dom/html');
    el.innerHTML = html;
    i.push(el as TakValue);
  });

  // dom/on ( el event quot -- el )
  // When the event fires: pushes el onto stack, then calls quot
  interp.defineWord('dom/on', i => {
    const quot = assertQuot(i.pop(), 'dom/on');
    const event = assertString(i.pop(), 'dom/on');
    const el = assertElement(i.pop(), 'dom/on');

    el.addEventListener(event, async (_ev) => {
      i.push(el as TakValue);
      try {
        await i.callQuot(quot);
      } catch (err) {
        console.error('[tak] dom/on handler error:', err);
      }
    });

    i.push(el as TakValue);
  });

  // dom/attr-get ( el attr -- val )
  interp.defineWord('dom/attr-get', i => {
    const attr = assertString(i.pop(), 'dom/attr-get');
    const el = assertElement(i.pop(), 'dom/attr-get');
    i.push(el.getAttribute(attr) ?? null);
  });

  // dom/attr-set ( el attr val -- el )
  interp.defineWord('dom/attr-set', i => {
    const val = assertString(i.pop(), 'dom/attr-set');
    const attr = assertString(i.pop(), 'dom/attr-set');
    const el = assertElement(i.pop(), 'dom/attr-set');
    el.setAttribute(attr, val);
    i.push(el as TakValue);
  });

  // dom/class-add ( el class -- el )
  interp.defineWord('dom/class-add', i => {
    const cls = assertString(i.pop(), 'dom/class-add');
    const el = assertElement(i.pop(), 'dom/class-add');
    el.classList.add(cls);
    i.push(el as TakValue);
  });

  // dom/class-rm ( el class -- el )
  interp.defineWord('dom/class-rm', i => {
    const cls = assertString(i.pop(), 'dom/class-rm');
    const el = assertElement(i.pop(), 'dom/class-rm');
    el.classList.remove(cls);
    i.push(el as TakValue);
  });

  // dom/remove ( el -- )
  interp.defineWord('dom/remove', i => {
    const el = assertElement(i.pop(), 'dom/remove');
    el.remove();
  });
}
