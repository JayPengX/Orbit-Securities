import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test("a stock's sheet is the kit's full-height sheet: it swipes down like every other app's and meets the phone's sides", async () => {
  const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(js, /kitSheet\('detail', \{\s*cls: 'q-full detail-sheet'/);
});
