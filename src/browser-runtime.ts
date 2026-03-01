// tak browser runtime — auto-scans <script type="text/tak"> and runs them

import { TakInterpreter } from './interpreter.js';
import { registerStdlib } from './stdlib.js';
import { registerDomStdlib } from './dom-stdlib.js';
import { attachDebugPanel } from './debug-panel.js';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';

/** Read data-debug from the <script src="tak.js"> tag */
function isDebugMode(): boolean {
  // Look for the script element that loaded this runtime
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') ?? '';
    if (src.includes('tak.js') || src.includes('tak.min.js')) {
      return script.getAttribute('data-debug') === 'true';
    }
  }
  return false;
}

/** Run a tak source string in the given interpreter */
async function runSource(source: string, interp: TakInterpreter): Promise<void> {
  const tokens = tokenize(source);
  const program = parse(tokens);
  await interp.run(program);
}

/** Bootstrap: find all tak scripts and run them */
async function bootstrap(): Promise<void> {
  const debug = isDebugMode();

  const interp = new TakInterpreter({ debug });
  registerStdlib(interp);
  registerDomStdlib(interp);

  if (debug) {
    attachDebugPanel(interp);
  }

  // Find all tak script blocks
  const takScripts = Array.from(document.querySelectorAll('script[type="text/tak"]'));

  for (const scriptEl of takScripts) {
    const source = scriptEl.textContent ?? '';
    if (!source.trim()) continue;

    try {
      await runSource(source, interp);
    } catch (err) {
      console.error('[tak] Runtime error:', err instanceof Error ? err.message : String(err));
    }
  }
}

// Run on DOMContentLoaded (or immediately if already loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { bootstrap().catch(console.error); });
} else {
  bootstrap().catch(console.error);
}

// Export public API for programmatic use
export { TakInterpreter } from './interpreter.js';
export { registerStdlib, takFormat } from './stdlib.js';
export { registerDomStdlib } from './dom-stdlib.js';
export { attachDebugPanel } from './debug-panel.js';
export { tokenize } from './lexer.js';
export { parse } from './parser.js';
export type { TakValue, TakWord, TakArray, TakDict, TakQuot } from './interpreter.js';
