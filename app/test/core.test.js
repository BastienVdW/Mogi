const test = require('node:test');
const assert = require('node:assert');
const Core = require('../public/core.js');

const mkTake = (over = {}) => ({
  testId: 't', sectionId: 's', limit: null, elapsed: 0, last: 0, times: {}, answers: {}, flags: {}, startedAt: '2026-01-01T00:00:00Z',
  data: { test: { title: 'T' }, section: { title: 'S', type: 'text' },
    groups: { g1: { title: 'G', instructions: 'i', passage: '', audio: '', hideChoices: false } },
    questions: [
      { id: 'q1', number: '1', group: 'g1', prompt: 'p', choices: ['a', 'b'], answer: 1, explanation: '', why: [], transcript: '' },
      { id: 'q2', number: '2', group: 'g1', prompt: 'p', choices: ['a', 'b'], answer: 2, explanation: '', why: [], transcript: '' },
      { id: 'q3', number: '3', group: 'g1', prompt: 'p', choices: ['a', 'b'], answer: 2, explanation: '', why: [], transcript: '' }] },
  ...over });

test('esc escapes html and tolerates null', () => {
  assert.strictEqual(Core.esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.strictEqual(Core.esc(null), '');
});

test('inl renders inline markup and escapes first', () => {
  assert.strictEqual(Core.inl('__u__ [[m]] **b** {41} {12-a}'), '<u>u</u> <mark>m</mark> <b>b</b> <span class="blank">41</span> <span class="blank">12-a</span>');
  assert.ok(!Core.inl('<script>').includes('<script>'));
});

test('fmt turns | rows into a table with a header row', () => {
  const h = Core.fmt('intro\n|A|B|\n|1|2|\nend');
  assert.ok(h.startsWith('intro<br><table class="tbl">'));
  assert.ok(h.includes('<tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr>'));
  assert.ok(h.endsWith('end<br>'));
  assert.strictEqual(Core.fmt(undefined), '<br>');
});

test('fmtTime formats m:ss and h:mm:ss, clamps negatives', () => {
  assert.strictEqual(Core.fmtTime(0), '0:00');
  assert.strictEqual(Core.fmtTime(65), '1:05');
  assert.strictEqual(Core.fmtTime(3600), '1:00:00');
  assert.strictEqual(Core.fmtTime(3725.4), '1:02:05');
  assert.strictEqual(Core.fmtTime(-5), '0:00');
  assert.strictEqual(Core.fmtTime(NaN), '0:00');
});

test('pctClass thresholds', () => {
  assert.deepStrictEqual([100, 60, 59, 40, 39, 0].map(Core.pctClass), ['good', 'good', 'warn', 'warn', 'bad', 'bad']);
});

test('promptHtml: empty, normal and blank-marker prompts', () => {
  assert.strictEqual(Core.promptHtml(''), '');
  assert.strictEqual(Core.promptHtml('hi'), '<div class="prompt">hi<br></div>');
  assert.ok(Core.promptHtml('{41}').startsWith('<div class="prompt">Blank <span class="blank">41</span>'));
});

test('advanceClock adds elapsed time to the total and the current question', () => {
  const t = mkTake({ last: 1000 });
  assert.strictEqual(Core.advanceClock(t, 2000, 'q1'), 1);
  Core.advanceClock(t, 3000, 'q1'); Core.advanceClock(t, 4000, 'q2');
  assert.strictEqual(t.elapsed, 3);
  assert.deepStrictEqual(t.times, { q1: 2, q2: 1 });
  assert.strictEqual(t.last, 4000);
});

test('advanceClock caps a long gap (sleeping tab / closed section) at MAX_TICK_SEC', () => {
  const t = mkTake({ last: 0 });
  Core.advanceClock(t, 3600 * 1000, 'q1');
  assert.strictEqual(t.elapsed, Core.MAX_TICK_SEC);
});

test('advanceClock never goes backwards if the system clock does', () => {
  const t = mkTake({ last: 5000 });
  Core.advanceClock(t, 1000, 'q1');
  assert.strictEqual(t.elapsed, 0);
  assert.strictEqual(t.last, 1000);
});

test('resume: a restored elapsed value continues, time away is not counted', () => {
  const t = mkTake({ elapsed: 600, limit: 1800 });
  t.last = Date.parse('2026-01-01T10:00:00Z');                 // section re-opened an hour after it was closed
  Core.advanceClock(t, t.last + 1000, 'q1');
  assert.strictEqual(t.elapsed, 601);
});

test('isTimeUp only fires for timed sections at or past the limit', () => {
  assert.strictEqual(Core.isTimeUp(mkTake({ limit: null, elapsed: 99999 })), false);
  assert.strictEqual(Core.isTimeUp(mkTake({ limit: 100, elapsed: 99.9 })), false);
  assert.strictEqual(Core.isTimeUp(mkTake({ limit: 100, elapsed: 100 })), true);
});

test('countTrue counts truthy flags', () => {
  assert.strictEqual(Core.countTrue({ a: true, b: false, c: true }), 2);
  assert.strictEqual(Core.countTrue({}), 0);
});

test('buildResult scores answers, keeps blanks, rounds time', () => {
  const t = mkTake({ limit: 600, elapsed: 61.6, answers: { q1: 1, q2: 1 }, flags: { q3: true }, times: { q1: 10.4 } });
  const r = Core.buildResult(t, false, '2026-01-01T01:00:00Z');
  const s = r.sections[0];
  assert.strictEqual(r.schemaVersion, 1);
  assert.strictEqual(r.createdAt, t.startedAt);
  assert.strictEqual(r.finishedAt, '2026-01-01T01:00:00Z');
  assert.deepStrictEqual(s.score, { correct: 1, total: 3, answered: 2, percent: 33 });
  assert.strictEqual(s.elapsedSec, 62);
  assert.strictEqual(s.timeLimitSec, 600);
  assert.strictEqual(s.timedOut, false);
  assert.deepStrictEqual(s.questions.map((q) => [q.selected, q.isCorrect, q.flagged, q.timeSec]), [[1, true, false, 10], [1, false, false, 0], [null, false, true, 0]]);
  assert.deepStrictEqual(Object.keys(s.groups), ['g1']);
});

test('buildResult marks timed-out attempts and survives an empty section', () => {
  const t = mkTake({ limit: 60, elapsed: 60 });
  assert.strictEqual(Core.buildResult(t, true, 'x').sections[0].timedOut, true);
  t.data.questions = [];
  assert.strictEqual(Core.buildResult(t, false, 'x').sections[0].score.percent, 0);
});
