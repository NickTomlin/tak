// Shim browser globals before interpreter modules load
// Must be first — esbuild banner injects this before bundle, but belt-and-suspenders here too
(globalThis as any).Element = (globalThis as any).Element ?? class Element {};

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { TakInterpreter, TakError } from './interpreter.js';
import { registerStdlib, takFormat } from './stdlib.js';
import { tokenize, LexError } from './lexer.js';
import { parse, ParseError } from './parser.js';

function createInterpreter(): TakInterpreter {
  const interp = new TakInterpreter();
  registerStdlib(interp);

  // Override . (print) and log to write to stdout
  interp.defineWord('.', i => {
    const v = i.pop();
    process.stdout.write(takFormat(v) + '\n');
  });
  interp.defineWord('log', i => {
    const v = i.pop();
    process.stdout.write(takFormat(v) + '\n');
  });

  return interp;
}

async function runSource(source: string, interp: TakInterpreter): Promise<void> {
  const tokens = tokenize(source);
  const program = parse(tokens);
  await interp.run(program);
}

async function runFile(filePath: string): Promise<void> {
  const source = await readFile(filePath, 'utf8');
  const interp = createInterpreter();
  await runSource(source, interp);
}

async function runStdin(): Promise<void> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  const source = chunks.join('');
  const interp = createInterpreter();
  await runSource(source, interp);
}

async function runRepl(): Promise<void> {
  const interp = createInterpreter();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'tak> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) { rl.prompt(); return; }
    rl.pause();
    try {
      await runSource(trimmed, interp);
      // Print remaining stack items (non-destructive peek)
      if (interp.stack.length > 0) {
        process.stdout.write('-- stack: [ ' + interp.stack.map(takFormat).join(' ') + ' ]\n');
      }
    } catch (err) {
      if (err instanceof LexError || err instanceof ParseError || err instanceof TakError) {
        process.stderr.write(err.message + '\n');
      } else {
        process.stderr.write(String(err) + '\n');
      }
    }
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    process.stdout.write('\n');
    process.exit(0);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  try {
    if (args.length > 0) {
      // File mode: tak <file>
      await runFile(args[0]);
    } else if (!process.stdin.isTTY) {
      // Stdin mode: echo "..." | tak
      await runStdin();
    } else {
      // Interactive REPL: tak
      await runRepl();
    }
  } catch (err) {
    if (err instanceof LexError || err instanceof ParseError || err instanceof TakError) {
      process.stderr.write(err.message + '\n');
    } else {
      process.stderr.write(String(err) + '\n');
    }
    process.exit(1);
  }
}

main();
