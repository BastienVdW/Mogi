// Integrity checks over every test installed in the data dir (skipped when none are installed).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseCsv } = require('../lib/csv');

const DATA = process.env.N1_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'N1Trainer');
const TESTS = path.join(DATA, 'tests');
const dirs = fs.existsSync(TESTS) ? fs.readdirSync(TESTS).filter((d) => fs.existsSync(path.join(TESTS, d, 'test.json'))) : [];
const rd = (f) => parseCsv(fs.readFileSync(f, 'utf8'));

if (!dirs.length) test('installed test data', { skip: 'no tests installed in ' + TESTS }, () => {});
for (const d of dirs) {
  const base = path.join(TESTS, d);
  const m = JSON.parse(fs.readFileSync(path.join(base, 'test.json'), 'utf8').replace(/^﻿/, ''));
  for (const s of m.sections) {
    test(`${d}/${s.id}: structure`, () => {
      const qs = rd(path.join(base, s.file));
      const groups = Object.fromEntries(rd(path.join(base, s.groups)).map((g) => [g.id, g]));
      assert.ok(qs.length > 0);
      assert.strictEqual(new Set(qs.map((q) => q.id)).size, qs.length, 'duplicate question ids');
      for (const q of qs) {
        const n = [q.choice1, q.choice2, q.choice3, q.choice4].filter(Boolean).length;
        assert.ok(n >= 2, `${q.id}: needs >= 2 choices`);
        const a = parseInt(q.answer, 10);
        assert.ok(a >= 1 && a <= n, `${q.id}: answer ${q.answer} out of range`);
        assert.ok(groups[q.group], `${q.id}: unknown group ${q.group}`);
        assert.ok(q.explanation, `${q.id}: missing explanation`);
        if (m.perChoiceNotes !== false) for (let i = 1; i <= n; i++) assert.ok(q['why' + i], `${q.id}: missing why${i}`);
        if (s.type === 'audio') assert.ok(q.transcript, `${q.id}: missing transcript`);
      }
      for (const g of Object.values(groups)) {
        if (g.audio) assert.ok(fs.existsSync(path.join(base, g.audio)), `missing audio ${g.audio}`);
      }
    });
  }
}
