// tak debug panel — floating overlay showing live stack and word history

import { TakInterpreter } from './interpreter.js';
import { takType, takFormat } from './stdlib.js';
import type { TakValue } from './interpreter.js';

const PANEL_ID = 'tak-debug-panel';
const MAX_HISTORY = 50;

const PANEL_STYLES = `
#tak-debug-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 320px;
  max-height: 480px;
  background: rgba(15, 15, 20, 0.92);
  border: 1px solid rgba(100, 200, 100, 0.4);
  border-radius: 8px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: #d4f4d4;
  z-index: 999999;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.2s;
}
#tak-debug-panel.hidden {
  opacity: 0;
  pointer-events: none;
}
#tak-debug-panel-header {
  padding: 6px 10px;
  background: rgba(40, 80, 40, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(100, 200, 100, 0.2);
  cursor: default;
  user-select: none;
}
#tak-debug-panel-title {
  font-weight: bold;
  color: #80ff80;
  letter-spacing: 0.05em;
}
#tak-debug-panel-hint {
  color: rgba(180, 255, 180, 0.5);
  font-size: 10px;
}
#tak-debug-panel-body {
  overflow-y: auto;
  flex: 1;
  padding: 8px 10px;
}
.tak-debug-section-title {
  color: rgba(180, 255, 180, 0.6);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 6px 0 4px;
}
.tak-debug-stack {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}
.tak-debug-stack-item {
  display: flex;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 3px;
  background: rgba(255,255,255,0.04);
}
.tak-debug-stack-item:first-child {
  background: rgba(100, 255, 100, 0.08);
  border-left: 2px solid #60c060;
}
.tak-debug-stack-type {
  color: #80a080;
  min-width: 48px;
  font-size: 10px;
  padding-top: 1px;
}
.tak-debug-stack-value {
  color: #d4f4d4;
  word-break: break-all;
}
.tak-debug-stack-empty {
  color: rgba(180, 255, 180, 0.3);
  font-style: italic;
}
.tak-debug-last-word {
  padding: 3px 6px;
  border-radius: 3px;
  background: rgba(100, 200, 100, 0.1);
  color: #a0ffa0;
}
.tak-debug-history {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 120px;
  overflow-y: auto;
}
.tak-debug-history-item {
  color: rgba(200, 255, 200, 0.4);
  font-size: 11px;
  padding: 1px 2px;
}
.tak-debug-history-item:last-child {
  color: rgba(200, 255, 200, 0.7);
}
.tak-debug-divider {
  border: none;
  border-top: 1px solid rgba(100, 200, 100, 0.15);
  margin: 6px 0;
}
`;

function injectStyles() {
  if (document.getElementById('tak-debug-styles')) return;
  const style = document.createElement('style');
  style.id = 'tak-debug-styles';
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
}

function formatValue(v: TakValue): string {
  const s = takFormat(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export function attachDebugPanel(interp: TakInterpreter): void {
  injectStyles();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'tak debug panel');

  panel.innerHTML = `
    <div id="tak-debug-panel-header">
      <span id="tak-debug-panel-title">tak debug</span>
      <span id="tak-debug-panel-hint">Ctrl+D to dismiss</span>
    </div>
    <div id="tak-debug-panel-body">
      <div class="tak-debug-section-title">Stack (top → bottom)</div>
      <div id="tak-debug-stack" class="tak-debug-stack"></div>
      <hr class="tak-debug-divider" />
      <div class="tak-debug-section-title">Last word</div>
      <div id="tak-debug-last-word" class="tak-debug-last-word">—</div>
      <hr class="tak-debug-divider" />
      <div class="tak-debug-section-title">History</div>
      <div id="tak-debug-history" class="tak-debug-history"></div>
    </div>
  `;

  document.body.appendChild(panel);

  const stackEl = panel.querySelector('#tak-debug-stack') as HTMLElement;
  const lastWordEl = panel.querySelector('#tak-debug-last-word') as HTMLElement;
  const historyEl = panel.querySelector('#tak-debug-history') as HTMLElement;

  const history: string[] = [];

  function renderStack(stack: TakValue[]) {
    if (stack.length === 0) {
      stackEl.innerHTML = '<span class="tak-debug-stack-empty">empty</span>';
      return;
    }
    // Display top-first (stack is bottom→top, we want top→bottom display)
    stackEl.innerHTML = [...stack].reverse().map((v, idx) => {
      const type = takType(v);
      const val = formatValue(v);
      return `<div class="tak-debug-stack-item">
        <span class="tak-debug-stack-type">${type}</span>
        <span class="tak-debug-stack-value">${escapeHtml(val)}</span>
      </div>`;
    }).join('');
  }

  function addHistory(word: string) {
    history.push(word);
    if (history.length > MAX_HISTORY) history.shift();
    historyEl.innerHTML = history.map(w =>
      `<div class="tak-debug-history-item">${escapeHtml(w)}</div>`
    ).join('');
    // Scroll to bottom
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  // Initial render
  renderStack([]);

  // Update on every afterWord
  interp.on<{ word: string; stack: TakValue[] }>('afterWord', ({ word, stack }) => {
    lastWordEl.textContent = word;
    renderStack(stack);
    addHistory(word);
  });

  // Update on error
  interp.on<{ error: Error; word: string; stack: TakValue[] }>('error', ({ word, stack }) => {
    lastWordEl.textContent = `⚠ ${word}`;
    lastWordEl.style.color = '#ff8080';
    renderStack(stack);
  });

  // Update on scriptEnd
  interp.on<{ stack: TakValue[] }>('scriptEnd', ({ stack }) => {
    renderStack(stack);
  });

  // Ctrl+D to dismiss
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      panel.classList.toggle('hidden');
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
