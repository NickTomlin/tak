// Stub DOM globals absent in Node
(globalThis as any).Element ??= class Element {};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TakInterpreter } from '../src/interpreter.js';
import { registerStdlib } from '../src/stdlib.js';
import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';

async function run(source: string) {
  const interp = new TakInterpreter({ debug: false });
  registerStdlib(interp);
  await interp.run(parse(tokenize(source)));
  return interp.stack;
}

test('arithmetic', async () => {
  assert.deepEqual(await run('3 4 +'), [7]);
  assert.deepEqual(await run('10 3 -'), [7]);
  assert.deepEqual(await run('3 4 *'), [12]);
});

test('stack ops', async () => {
  assert.deepEqual(await run('1 2 dup'), [1, 2, 2]);
  assert.deepEqual(await run('1 2 swap'), [2, 1]);
  assert.deepEqual(await run('1 2 drop'), [1]);
});

test('comparison', async () => {
  assert.deepEqual(await run('3 4 <'), [true]);
  assert.deepEqual(await run('3 3 ='), [true]);
  assert.deepEqual(await run('5 3 >'), [true]);
});

test('function definition', async () => {
  assert.deepEqual(await run('fn square ( n -- n ) { dup * } 5 square'), [25]);
});

test('array literal', async () => {
  const [arr] = await run('[ 1 2 3 ]') as any[];
  assert.equal(arr.kind, 'array');
  assert.deepEqual(arr.items, [1, 2, 3]);
});

test('map', async () => {
  const [arr] = await run('[ 1 2 3 ] [ dup * ] map') as any[];
  assert.deepEqual(arr.items, [1, 4, 9]);
});

test('if combinator', async () => {
  assert.deepEqual(await run('true [ 1 ] [ 2 ] if'), [1]);
  assert.deepEqual(await run('false [ 1 ] [ 2 ] if'), [2]);
});
