const test = require('node:test');
const assert = require('node:assert');
const { parseCsv } = require('../lib/csv');

test('parses header + rows into objects', () => {
  assert.deepStrictEqual(parseCsv('a,b\n1,2\n3,4\n'), [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});
test('strips UTF-8 BOM', () => {
  assert.deepStrictEqual(parseCsv('﻿id,x\n1,y'), [{ id: '1', x: 'y' }]);
});
test('handles quoted commas, escaped quotes and embedded newlines', () => {
  const r = parseCsv('id,t\n1,"a,b"\n2,"say ""hi"""\n3,"line1\nline2"\n');
  assert.deepStrictEqual(r.map((x) => x.t), ['a,b', 'say "hi"', 'line1\nline2']);
});
test('handles CRLF line endings', () => {
  assert.strictEqual(parseCsv('a,b\r\n1,2\r\n').length, 1);
});
test('missing trailing fields become empty strings; blank lines skipped', () => {
  assert.deepStrictEqual(parseCsv('a,b,c\n1\n\n2,3,4'), [{ a: '1', b: '', c: '' }, { a: '2', b: '3', c: '4' }]);
});
test('keeps Japanese text intact', () => {
  assert.strictEqual(parseCsv('id,p\n1,日本語')[0].p, '日本語');
});
