import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A tab tapped in the bar comes back where it was left (Jay 2026-11-05:
// "switching tab force it to scroll back up"): the kit's bar puts its place
// back in the tap, so the app's draw after the pill lands never scrolls to
// the top. A tab opened from a link (a pair's 換匯) still opens at its top.
const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('the tab bar opens a tab without scrolling it to the top', () => {
  assert.match(src, /onSelect: \(tab, \{ again \}\) => !again && showTab\(tab, \{ keep: true \}\)/);
  assert.match(src, /function showTab\(tab, \{ keep = false \} = \{\}\) \{[\s\S]{0,120}if \(!keep\) window\.scrollTo\(0, 0\);/);
});
