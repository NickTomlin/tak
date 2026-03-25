# tak

**tak** is a small stack-based language that runs in the browser. Inspired by Factor's
quotation model, PostScript's dictionary flavor, and a desire for maximum debuggability.
The name means "thank you" in Danish — a tribute to the language hackers who came before.

---

## Quick Start

```html
<script src="tak.js"></script>
<script type="text/tak">
  fn greet ( str -- ) { "Hello, " swap concat . }
  "World" greet
</script>
```

Enable the live debug panel (floating stack overlay):

```html
<script src="tak.js" data-debug="true"></script>
```

---

## Syntax

### Literals

```
42          // integer
3.14        // float
"hello"     // string (supports \n \t \r \" \\)
true false  // booleans
null
```

### Function definitions (stack effects required)

```
fn square ( n -- n ) { dup * }
fn greet  ( str -- ) { "Hello, " swap concat . }
```

### Quotations / arrays

```
[ 1 2 3 ]         // array of numbers (pushed as a value)
[ 1 + ]           // callable quotation
[ "hello" . ]     // quotation pushed as a value, called with 'call'
```

### Dict literals

```
{ name: "Alice", age: 30 }
```

### Control flow (combinators)

```
5 0 > [ "positive" . ] [ "non-positive" . ] if
10 [ dup 0 > ] [ 1 - ] while
5 [ "tick" . ] times
true [ "yes" . ] when
```

### JavaScript escape hatch

```
@js(document.querySelector('#app'))
@js(Math.random())
```

### Comments

```
// line comment
```

---

## Standard Library

### Stack
| Word | Effect | Description |
|------|--------|-------------|
| `dup` | `( a -- a a )` | Duplicate top |
| `drop` | `( a -- )` | Discard top |
| `swap` | `( a b -- b a )` | Swap top two |
| `over` | `( a b -- a b a )` | Copy second |
| `rot` | `( a b c -- b c a )` | Rotate top three |
| `nip` | `( a b -- b )` | Drop second |
| `tuck` | `( a b -- b a b )` | Copy top under second |

### Arithmetic
`+  -  *  /  %  **  neg`

### Comparison → boolean
`=  !=  <  >  <=  >=`

### Logic
`and  or  not`

### String
| Word | Effect |
|------|--------|
| `concat` | `( str str -- str )` |
| `length` | `( str\|arr -- n )` |
| `substr` | `( str start end -- str )` |
| `split` | `( str sep -- arr )` |

### Array / Quotation
| Word | Effect |
|------|--------|
| `push` | `( arr val -- arr )` |
| `pop` | `( arr -- arr val )` |
| `nth` | `( arr n -- val )` |
| `map` | `( arr quot -- arr )` |
| `filter` | `( arr quot -- arr )` |
| `reduce` | `( arr init quot -- val )` |
| `each` | `( arr quot -- )` |
| `call` | `( quot -- )` |

### Dict
| Word | Effect |
|------|--------|
| `get` | `( dict key -- val )` |
| `set` | `( dict key val -- dict )` |
| `has` | `( dict key -- bool )` |
| `keys` | `( dict -- arr )` |

### Control
| Word | Effect |
|------|--------|
| `if` | `( bool true-q false-q -- )` |
| `when` | `( bool quot -- )` |
| `unless` | `( bool quot -- )` |
| `while` | `( cond-q body-q -- )` |
| `times` | `( n quot -- )` |

### I/O
- `.` / `log` — print top of stack to console
- `str` — `( val -- str )` — convert any value to its string representation

### Type
- `type` — push type name as string: `"number"`, `"string"`, `"bool"`, `"array"`, `"dict"`, `"quot"`, `"null"`, `"element"`
- `number?  string?  bool?  array?  dict?  null?  quot?`

### Async / Fetch
| Word | Effect | Description |
|------|--------|-------------|
| `fetch` | `( url -- Promise )` | HTTP GET |
| `fetch-post` | `( url body -- Promise )` | HTTP POST; body can be string or dict |
| `await` | `( Promise -- val )` | Resolve a promise |
| `response/json` | `( Response -- val )` | Read response body as JSON → tak value |
| `response/text` | `( Response -- str )` | Read response body as plain text |
| `json/parse` | `( str -- val )` | Parse a JSON string |
| `json/str` | `( val -- str )` | Serialize a tak value to JSON |

```
"https://example.com/api" fetch await response/json   // → tak dict/array
"https://example.com/api" fetch await response/text   // → string
"https://example.com/api" { x: 1 } fetch-post await response/json
'{"x":1}' json/parse
{ x: 1 } json/str
```

### JS Interop
| Word | Effect | Description |
|------|--------|-------------|
| `import` | `( url -- Promise )` | Dynamic JS module import (async; use `await`) |
| `js/get` | `( js key -- val )` | Read a property from a JS object |
| `js/call` | `( js arg1..argN n -- result )` | Call a JS function with N args |
| `js/unwrap` | `( js -- val )` | Convert a JS value to a tak value |

```
"https://cdn.example.com/lib.js" import await   // ( -- js-module )
"Chart" js/get                                   // ( js-module -- Chart )
0 js/call                                        // call with 0 args
```

### Static Imports (`use`)

`use` is a hoisted import — all URLs are fetched concurrently before the program runs, with results available synchronously at the call site.

```
"./lib.js" use                           ( -- module )
"./lib.js" [ Chart ] use                 // defines word `Chart`
"./lib.js" [ renderFn as render ] use    // defines word `render`
"./lib.js" [ Chart renderFn as render ] use
```

The URL must be a string literal (known at parse time). Without a binding list, the whole module is pushed onto the stack. With bindings, each named export becomes a word that pushes its value.

### Debug
- `trace` — log top value without consuming it
- `debug` — fire debug event + log full stack

### DOM
| Word | Effect |
|------|--------|
| `dom/query` | `( selector -- el\|null )` |
| `dom/query-all` | `( selector -- arr )` |
| `dom/create` | `( tag -- el )` |
| `dom/append` | `( parent child -- parent )` |
| `dom/text` | `( el str -- el )` |
| `dom/html` | `( el str -- el )` |
| `dom/on` | `( el event quot -- el )` |
| `dom/attr-get` | `( el attr -- val )` |
| `dom/attr-set` | `( el attr val -- el )` |
| `dom/class-add` | `( el class -- el )` |
| `dom/class-rm` | `( el class -- el )` |
| `dom/remove` | `( el -- )` |

`dom/on` pushes the element onto the stack before calling the quotation.

---

## Debug Panel API

```js
const interp = new Tak.TakInterpreter({ debug: true });

interp.on('beforeWord', ({ word, stack }) => { });
interp.on('afterWord',  ({ word, stack }) => { });
interp.on('push',       ({ value, stack }) => { });
interp.on('pop',        ({ value, stack }) => { });
interp.on('error',      ({ error, word, stack }) => { });
interp.on('scriptEnd',  ({ stack }) => { });

interp.stack   // read-only snapshot
interp.dict    // Map of all defined words
```

`Ctrl+D` toggles the debug overlay when `data-debug="true"` is set.

---

## Programmatic Use

```js
import { TakInterpreter, registerStdlib, registerDomStdlib } from './dist/tak.js';
import { tokenize } from './dist/tak.js';
import { parse } from './dist/tak.js';

const interp = new TakInterpreter({ debug: true });
registerStdlib(interp);
registerDomStdlib(interp);

const tokens = tokenize('5 3 + .');
const program = parse(tokens);
await interp.run(program);
```

---

## Project Structure

```
src/
  lexer.ts          — tokenizer
  parser.ts         — recursive-descent parser
  ast.ts            — AST node types
  interpreter.ts    — tree-walking interpreter + event system
  stdlib.ts         — built-in words
  dom-stdlib.ts     — DOM words
  debug-panel.ts    — floating stack overlay
  browser-runtime.ts — script tag scanner + bootstrap
examples/
  hello.html        — stack ops, fn defs, combinators
  counter.html      — DOM event handling
  fetch.html        — async fetch with debug panel
```

---

## Build

```sh
npm install
npm run build        # production bundle → dist/tak.js
npm run build:dev    # with source maps
npm run watch        # watch mode
npm run typecheck    # tsc type check only
```

---

## License

MIT
