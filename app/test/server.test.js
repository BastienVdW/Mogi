const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

let proc, base, dir;
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const get = (p, headers) => fetch(base + p, { headers });
const post = (p, body) => fetch(base + p, { method: 'POST', body: JSON.stringify(body) });
const del = (p) => fetch(base + p, { method: 'DELETE' });

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n1test-'));
  const t = path.join(dir, 'tests', 'demo');
  fs.mkdirSync(path.join(t, 'sections'), { recursive: true });
  fs.mkdirSync(path.join(t, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(t, 'audio', 'a.mp3'), Buffer.alloc(1000, 1));
  fs.writeFileSync(path.join(t, 'test.json'), JSON.stringify({ id: 'demo', title: 'Demo', level: 'N1',
    sections: [{ id: 's1', title: 'S1', file: 'sections/s1.csv', groups: 'sections/s1.groups.csv', timeLimitMin: 5, type: 'audio' }] }));
  fs.writeFileSync(path.join(t, 'sections', 's1.csv'),
    '﻿id,group,number,prompt,choice1,choice2,choice3,choice4,answer,explanation,why1,why2,why3,why4,transcript,audio_start\n' +
    'q1,g1,1,"Pick, one",A,B,C,D,2,Because,w1,w2,w3,w4,[[hi]],12.5\n' +
    'q2,g1,2,Two,X,Y,Z,,3,Ex,a,b,c,,,\n');
  fs.writeFileSync(path.join(t, 'sections', 's1.groups.csv'),
    'id,title,instructions,passage,audio,hide_choices\ng1,Mondai 1,Do it,,audio/a.mp3,1\n');
  fs.writeFileSync(path.join(dir, 'secret.json'), '{}');
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js'), '--port', String(port), '--data', dir, '--no-open'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await get('/api/config'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});
test.after(() => { if (proc) proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('config reports the data dir', async () => {
  assert.strictEqual((await (await get('/api/config')).json()).dataDir, path.resolve(dir));
});

test('lists tests with section question counts', async () => {
  const t = await (await get('/api/tests')).json();
  assert.strictEqual(t.length, 1);
  assert.deepStrictEqual(t[0].sections.map((s) => [s.id, s.count, s.type, s.timeLimitMin]), [['s1', 2, 'audio', 5]]);
});

test('section loads questions, choices, why, transcript, groups', async () => {
  const d = await (await get('/api/tests/demo/sections/s1')).json();
  assert.strictEqual(d.questions.length, 2);
  const [q1, q2] = d.questions;
  assert.strictEqual(q1.prompt, 'Pick, one');
  assert.deepStrictEqual(q1.choices, ['A', 'B', 'C', 'D']);
  assert.strictEqual(q1.answer, 2);
  assert.strictEqual(q1.audioStart, 12.5);
  assert.strictEqual(q1.transcript, '[[hi]]');
  assert.deepStrictEqual(q2.choices, ['X', 'Y', 'Z']);
  assert.strictEqual(q2.why.length, 3);
  assert.strictEqual(q2.audioStart, null);
  assert.strictEqual(d.groups.g1.hideChoices, true);
  assert.strictEqual(d.groups.g1.audio, 'audio/a.mp3');
});

test('unknown section / test return an error status', async () => {
  assert.strictEqual((await get('/api/tests/demo/sections/nope')).status, 404);
  assert.ok((await get('/api/tests/missing/sections/s1')).status >= 400);
  assert.strictEqual((await get('/api/config')).status, 200); // server still alive
});

test('results: save, list, read, delete', async () => {
  const body = { id: 'r1', finishedAt: '2024-01-02T00:00:00Z', sections: [{ testId: 'demo', sectionId: 's1', score: { correct: 1, total: 2 }, questions: [] }] };
  assert.strictEqual((await (await post('/api/results', body)).json()).id, 'r1');
  const list = await (await get('/api/results')).json();
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0].sections[0].score, { correct: 1, total: 2 });
  assert.strictEqual((await (await get('/api/results/r1')).json()).id, 'r1');
  await del('/api/results/r1');
  assert.strictEqual((await get('/api/results/r1')).status, 404);
});

test('results: unsafe or missing id is replaced by a generated safe id', async () => {
  const id = (await (await post('/api/results', { id: '../evil', sections: [] })).json()).id;
  assert.match(id, /^[A-Za-z0-9._-]+$/);
  assert.ok(!id.includes('..'));
  await del('/api/results/' + id);
});

test('results list is newest first', async () => {
  await post('/api/results', { id: 'old', finishedAt: '2020-01-01', sections: [] });
  await post('/api/results', { id: 'new', finishedAt: '2024-01-01', sections: [] });
  const ids = (await (await get('/api/results')).json()).map((r) => r.id);
  assert.deepStrictEqual(ids, ['new', 'old']);
  for (const i of ids) await del('/api/results/' + i);
});

test('media supports Range requests', async () => {
  const r = await get('/media/demo/audio/a.mp3', { Range: 'bytes=0-99' });
  assert.strictEqual(r.status, 206);
  assert.strictEqual(r.headers.get('content-range'), 'bytes 0-99/1000');
  assert.strictEqual((await r.arrayBuffer()).byteLength, 100);
  const full = await get('/media/demo/audio/a.mp3');
  assert.strictEqual(full.status, 200);
  assert.strictEqual(full.headers.get('content-type'), 'audio/mpeg');
});

test('media refuses csv/json (they contain the answers) and path traversal', async () => {
  assert.strictEqual((await get('/media/demo/sections/s1.csv')).status, 403);
  assert.strictEqual((await get('/media/demo/test.json')).status, 403);
  const raw = await new Promise((ok) => { // a raw socket avoids client-side path normalisation
    const s = net.connect(new URL(base).port, '127.0.0.1', () => s.write('GET /media/demo/..%2f..%2fsecret.json HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let d = '';
    s.on('data', (c) => { d += c; });
    s.on('end', () => ok(d));
  });
  assert.doesNotMatch(raw, /^HTTP\/1\.1 200/);
});

test('static: index served at / and unknown files 404', async () => {
  const r = await get('/');
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /<html/i);
  assert.strictEqual((await get('/nope.js')).status, 404);
});
