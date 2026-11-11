import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_THUMB_WIDTH, parseThumbWidth, thumbPath, thumbSrc } from '../src/lib/thumb';

test('thumbPath carries the photo version so caches roll over when the photo changes', () => {
  assert.equal(thumbPath('abc', 1700000000000), '/api/members/abc/thumb?v=1700000000000');
  assert.notEqual(thumbPath('abc', 1), thumbPath('abc', 2));
});

test('thumbSrc appends an allowed width and passes null through', () => {
  assert.equal(thumbSrc('/api/members/abc/thumb?v=1', 160), '/api/members/abc/thumb?v=1&w=160');
  assert.equal(thumbSrc(null, 480), null);
});

test('parseThumbWidth only accepts whitelisted widths', () => {
  assert.equal(parseThumbWidth('160'), 160);
  assert.equal(parseThumbWidth('480'), 480);
  assert.equal(parseThumbWidth('9999'), DEFAULT_THUMB_WIDTH);
  assert.equal(parseThumbWidth('abc'), DEFAULT_THUMB_WIDTH);
  assert.equal(parseThumbWidth(null), DEFAULT_THUMB_WIDTH);
});
