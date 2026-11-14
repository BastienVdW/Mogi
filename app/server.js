#!/usr/bin/env node
/* JLPT Trainer: tiny dependency-free server.
 * - App code lives here (app/). User data lives OUTSIDE the app:
 *     <dataDir>/tests/<testId>/{test.json, sections/*.csv, audio/*}
 *     <dataDir>/results/<resultId>.json
 *   dataDir = $N1_DATA_DIR, or --data <dir>, or %APPDATA%\N1Trainer (Windows) / ~/.config/N1Trainer.
 * Usage: node server.js [--port 4821] [--data DIR] [--no-open]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { parseCsv } = require('./lib/csv');

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const PORT = parseInt(arg('port', process.env.N1_PORT || '4821'), 10);
const DATA_DIR = path.resolve(arg('data', process.env.N1_DATA_DIR ||
  path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'N1Trainer')));
const TESTS_DIR = path.join(DATA_DIR, 'tests');
const RESULTS_DIR = path.join(DATA_DIR, 'results');
const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdirSync(TESTS_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const safeId = (s) => /^[A-Za-z0-9._-]+$/.test(s) && !s.startsWith('.');
const sendJson = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(b); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const readBody = (req) => new Promise((ok, fail) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 20e6) req.destroy(); }); req.on('end', () => ok(d)); req.on('error', fail); });

/* ---------- tests ---------- */
function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
}
function loadSection(testId, sectionId) {
  const manifest = readJson(path.join(TESTS_DIR, testId, 'test.json'));
  const sec = (manifest.sections || []).find((s) => s.id === sectionId);
  if (!sec) return null;
  const base = path.join(TESTS_DIR, testId);
  const rows = readCsv(path.join(base, sec.file));
  const grows = sec.groups ? readCsv(path.join(base, sec.groups)) : [];
  const groups = {};
  for (const g of grows) groups[g.id] = { id: g.id, title: g.title || '', instructions: g.instructions || '', passage: g.passage || '', audio: g.audio || '', hideChoices: g.hide_choices === '1' || /^true$/i.test(g.hide_choices || '') };
  const questions = rows.filter((r) => r.id).map((r) => {
    const choices = [r.choice1, r.choice2, r.choice3, r.choice4].filter((c) => c !== undefined && c !== '');
    return { id: r.id, group: r.group || '', number: r.number || r.id, prompt: r.prompt || '', choices, answer: parseInt(r.answer, 10),
      explanation: r.explanation || '', why: [r.why1, r.why2, r.why3, r.why4].slice(0, choices.length).map((x) => x || ''),
      transcript: r.transcript || '', audioStart: r.audio_start ? parseFloat(r.audio_start) : null };
  });
  return { test: { id: manifest.id || testId, title: manifest.title || testId }, section: { id: sec.id, title: sec.title, timeLimitMin: sec.timeLimitMin || null, type: sec.type || 'text' }, groups, questions };
}
function listTests() {
  const out = [];
  for (const d of fs.readdirSync(TESTS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || !safeId(d.name)) continue;
    try {
      const m = readJson(path.join(TESTS_DIR, d.name, 'test.json'));
      const sections = (m.sections || []).map((s) => {
        let count = 0;
        try { count = readCsv(path.join(TESTS_DIR, d.name, s.file)).filter((r) => r.id).length; } catch (e) { /* ignore */ }
        return { id: s.id, title: s.title, timeLimitMin: s.timeLimitMin || null, type: s.type || 'text', count };
      });
      out.push({ id: m.id || d.name, dir: d.name, title: m.title || d.name, level: m.level || '', description: m.description || '', source: m.source || '', sections });
    } catch (e) { console.warn('Skipping test', d.name, e.message); }
  }
  return out;
}

/* ---------- results ---------- */
function resultSummary(r) {
  return { id: r.id, schemaVersion: r.schemaVersion, createdAt: r.createdAt, finishedAt: r.finishedAt,
    sections: (r.sections || []).map((s) => ({ testId: s.testId, testTitle: s.testTitle, sectionId: s.sectionId, sectionTitle: s.sectionTitle, type: s.type,
      elapsedSec: s.elapsedSec, timeLimitSec: s.timeLimitSec, timedOut: !!s.timedOut, score: s.score })) };
}
function listResults() {
  const out = [];
  for (const f of fs.readdirSync(RESULTS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try { out.push(resultSummary(readJson(path.join(RESULTS_DIR, f)))); } catch (e) { console.warn('Bad result file', f); }
  }
  return out.sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
}

/* ---------- static / media ---------- */
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size || end >= st.size) end = st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('audio') ? 'max-age=3600' : 'no-cache' });
      fs.createReadStream(file).pipe(res);
    }
  });
}
const within = (base, p) => { const r = path.resolve(base, p); return r.startsWith(path.resolve(base) + path.sep) ? r : null; };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'api') {
      if (parts[1] === 'config') return sendJson(res, 200, { dataDir: DATA_DIR });
      if (parts[1] === 'tests' && parts.length === 2) return sendJson(res, 200, listTests());
      if (parts[1] === 'tests' && parts[3] === 'sections' && parts[4] && safeId(parts[2]) && safeId(parts[4])) {
        const data = loadSection(parts[2], parts[4]);
        return data ? sendJson(res, 200, data) : sendJson(res, 404, { error: 'section not found' });
      }
      if (parts[1] === 'results') {
        if (req.method === 'GET' && parts.length === 2) return sendJson(res, 200, listResults());
        if (req.method === 'POST' && parts.length === 2) {
          const r = JSON.parse(await readBody(req));
          if (!r.id || !safeId(r.id)) r.id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 6);
          fs.writeFileSync(path.join(RESULTS_DIR, r.id + '.json'), JSON.stringify(r, null, 2));
          return sendJson(res, 200, { id: r.id });
        }
        if (parts[2] && safeId(parts[2])) {
          const f = path.join(RESULTS_DIR, parts[2] + '.json');
          if (req.method === 'GET') return fs.existsSync(f) ? sendJson(res, 200, readJson(f)) : sendJson(res, 404, { error: 'not found' });
          if (req.method === 'DELETE') { if (fs.existsSync(f)) fs.unlinkSync(f); return sendJson(res, 200, { ok: true }); }
        }
      }
      return sendJson(res, 404, { error: 'unknown api' });
    }
    if (parts[0] === 'media' && parts.length >= 3 && safeId(parts[1])) {
      const f = within(path.join(TESTS_DIR, parts[1]), parts.slice(2).join('/'));
      if (!f || /\.(csv|json)$/i.test(f)) { res.writeHead(403); return res.end(); }
      return serveFile(req, res, f);
    }
    const rel = url.pathname === '/' ? 'index.html' : parts.join('/');
    const f = within(PUBLIC_DIR, rel);
    if (!f) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, f);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: String(e.message || e) });
  }
});

function openBrowser(u) {
  if (argv.includes('--no-open')) return;
  const cmd = process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`;
  exec(cmd);
}
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`JLPT Trainer already running on port ${PORT}; opening the browser.`); openBrowser(`http://127.0.0.1:${PORT}`); setTimeout(() => process.exit(0), 300); }
  else throw e;
});
server.listen(PORT, '127.0.0.1', () => {
  const u = `http://127.0.0.1:${PORT}`;
  console.log(`JLPT Trainer running at ${u}\nData folder: ${DATA_DIR}\nPress Ctrl+C to stop.`);
  openBrowser(u);
});
