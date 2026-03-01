# Critical Fixes Design

**Goal:** Fix three critical bugs and one important API change identified in PR review.

**Fixes:**
1. Export `takFormat` and use it in REPL/test harness (`.` displays `[object Object]` for complex types)
2. `@js(...)` string-aware paren matching (closes early on `)` inside string literals)
3. `dom/on` serialization queue (async handlers on shared stack corrupt it under rapid firing)
4. `await` no longer auto-calls `.json()` on Response; add `response/json` and `response/text` words

---

## Fix 1: `takFormat` export

- Add `export { takFormat } from './stdlib.js'` to `browser-runtime.ts`
- Rebuild `dist/tak.js`
- In `index.html`: replace `String(i.pop())` with `Tak.takFormat(i.pop())` in printFn, and `interp.stack.map(String)` with `interp.stack.map(Tak.takFormat)` in the stack display
- In `test-harness/index.html`: same replacement in `runSnippet`'s printFn

## Fix 2: `@js(...)` string-aware lexer

In the `@js` scan loop in `lexer.ts`, track `inString: false` and `stringChar: ''`. When a `"` or `'` is encountered outside a string, enter string mode. When the matching closing quote is seen (and it's not escaped), exit string mode. Only count `(` and `)` for depth when not in string mode. Handle `\"` and `\'` by checking the previous character.

## Fix 3: `dom/on` serialization queue

In `dom-stdlib.ts`, each call to `dom/on` creates a local `queue: Promise<void> = Promise.resolve()`. Each event fires a closure that appends to the chain: `queue = queue.then(() => { i.push(el); return i.callQuot(quot); })`. The shared interpreter stack is protected because only one `.then()` body runs at a time.

## Fix 4: `await` raw + new response words

- Remove the `instanceof Response` branch from `await` in `stdlib.ts` — just resolve the promise and push via `jsToTak(resolved)` (which will push a JS object, not a Response, but see below)
- Actually: push the raw value as-is (a Response object is not a plain JS object, so `jsToTak` won't work). Push it directly as `TakValue` (Response is not in the TakValue union but can be held as `unknown`/`any`).
- Add `response/json`: pops a Response, calls `.json()`, awaits, pushes via `jsToTak`
- Add `response/text`: pops a Response, calls `.text()`, awaits, pushes the string
- Update `examples/fetch.html` to call `response/json` after `await`

**Note on TakValue and Response:** Response is not in the `TakValue` union. The cleanest approach is to store it as `unknown` wrapped in a plain object `{ kind: 'response', value: res }`, or simply cast it as `TakValue` (the union already has `Element` as a special case — same pattern). Use the same cast pattern.
