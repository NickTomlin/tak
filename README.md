# tak

**tak** is a small stack-based language that runs in the browser. Inspired by Factor's
quotation model, PostScript's dictionary flavor, and a desire for maximum debuggability.
The name means "thank you" in Danish — a tribute to the language hackers who came before.

---

## A Taste of tak

Values are pushed onto a stack and words consume and produce them. No variables — only the stack.

```
3 4 + dup *   // stack: [ 49 ]

fn factorial ( n -- n ) {
  dup 1 > [ dup 1 - factorial * ] [ drop 1 ] if
}
5 factorial .   // prints 120

[ 1 2 3 4 5 ] [ dup * ] map .   // prints [ 1 4 9 16 25 ]

"https://api.example.com/data" fetch await response/json
"results" get 0 nth "name" get .
```

---

## Quick Start

Load tak from a CDN — no build step, no install:

```html
<!-- ESM via esm.sh -->
<script type="module" src="https://esm.sh/@nicktomlin/tak"></script>

<!-- or classic script via unpkg -->
<script src="https://unpkg.com/@nicktomlin/tak/dist/tak.js"></script>
```

Then write tak inline:

```html
<script type="text/tak">
  fn greet ( str -- ) { "Hello, " swap concat . }
  "World" greet
</script>
```

Enable the live debug panel (floating stack overlay, `Ctrl+D` to dismiss):

```html
<script type="module" src="https://esm.sh/@nicktomlin/tak" data-debug="true"></script>
```

---

## Full Documentation

Syntax reference, standard library, DOM words, async/fetch, JS interop, and programmatic API:

[**docs/index.html**](https://github.com/NickTomlin/tak/blob/main/docs/index.html)

*(A GitHub Pages site is coming — this will be updated to a live URL.)*

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
