'use strict';
/* JLPT Trainer front-end (vanilla JS, hash routing). All data comes from the local server API. Pure helpers live in core.js. */
const $app = document.getElementById('app');
const KEY = { progress: 'n1.inprogress', timed: 'n1.timed', feedback: 'n1.feedback' };   // localStorage keys (names kept so existing progress/settings survive)
const S = { take: null, cleanup: null, tests: null };
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };

async function api(path, opt) {
  const r = await fetch(path, opt);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const { esc, inl, fmt, fmtTime, pctClass, promptHtml } = Core;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const mediaUrl = (testId, rel) => '/media/' + encodeURIComponent(testId) + '/' + rel.split('/').map(encodeURIComponent).join('/');
const scorePill = (sc) => `<span class="pill ${pctClass(sc.percent)}">${sc.correct}/${sc.total} · ${sc.percent}%</span>`;
function modal(html) { const m = document.getElementById('modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.classList.remove('hidden'); return m; }
const closeModal = () => document.getElementById('modal').classList.add('hidden');

/* ---------------- router ---------------- */
async function route() {
  if (S.cleanup) { S.cleanup(); S.cleanup = null; }
  closeModal();
  const h = location.hash.replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === (parts[0] === 'history' || parts[0] === 'result' ? 'history' : 'home')));
  try {
    if (!parts.length) return await viewHome();
    if (parts[0] === 'history') return await viewHistory();
    if (parts[0] === 'result') return await viewResult(parts[1]);
    if (parts[0] === 'take') return S.take ? viewTake() : (location.hash = '#/');
    location.hash = '#/';
  } catch (e) { $app.innerHTML = `<div class="card"><b>Error</b><pre>${esc(e.message)}</pre></div>`; }
}
window.addEventListener('hashchange', route);

/* ---------------- home ---------------- */
async function viewHome() {
  const [tests, results, cfg] = await Promise.all([api('/api/tests'), api('/api/results'), api('/api/config')]);
  S.tests = tests;
  const stat = {};
  for (const r of results) for (const s of r.sections) {
    const k = s.testId + '/' + s.sectionId; const a = stat[k] || (stat[k] = { n: 0, best: 0, last: null });
    a.n++; a.best = Math.max(a.best, s.score.percent); if (!a.last) a.last = s.score;
  }
  const prog = LS.get(KEY.progress, null);
  const timed = LS.get(KEY.timed, true), fb = LS.get(KEY.feedback, false);
  $app.innerHTML = `<h1>Tests</h1>
    ${prog ? `<div class="card row"><div class="grow"><b>Unfinished attempt</b><div class="muted small">${esc(prog.testTitle)} – ${esc(prog.sectionTitle)} · ${Object.keys(prog.answers).length} answered · ${fmtTime(prog.elapsed)} elapsed</div></div>
      <button class="primary" id="resume">Resume</button><button class="danger" id="discard">Discard</button></div>` : ''}
    <label class="row small" style="margin-bottom:10px"><input type="checkbox" id="timed" ${timed ? 'checked' : ''}> Timed (countdown with the official time limit; auto-submit at zero)</label>
    <label class="row small" style="margin-bottom:10px"><input type="checkbox" id="fb" ${fb ? 'checked' : ''}> Instant feedback (after you answer, the correct answer and explanation are shown and your answer is locked)</label>
    ${tests.length ? tests.map((t) => `<div class="card"><div class="row"><h2 style="margin:0" class="grow">${esc(t.title)}</h2><span class="tag">${esc(t.level)}</span></div>
      <div class="muted small">${esc(t.description)}</div><div style="margin-top:8px">
      ${t.sections.map((s) => { const st = stat[t.id + '/' + s.id]; return `<div class="sec"><div class="grow"><b>${esc(s.title)}</b>
        <div class="muted small">${s.count} questions · ${s.timeLimitMin ? s.timeLimitMin + ' min' : 'no limit'} · ${s.type === 'audio' ? '🔊 audio' : 'text'}</div></div>
        <div class="small muted">${st ? `${st.n} attempt${st.n > 1 ? 's' : ''} · best ${st.best}% · last ${st.last.percent}%` : 'not taken yet'}</div>
        <button class="primary" data-start="${esc(t.id)}|${esc(s.id)}">Start</button></div>`; }).join('')}</div></div>`).join('')
      : '<div class="card">No tests found. Put test folders under:<br><code>' + esc(cfg.dataDir) + '\\tests</code></div>'}
    <p class="muted small">Data folder: ${esc(cfg.dataDir)} (tests/ and results/ – separate from the app)</p>`;
  document.getElementById('timed').onchange = (e) => LS.set(KEY.timed, e.target.checked);
  document.getElementById('fb').onchange = (e) => LS.set(KEY.feedback, e.target.checked);
  $app.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => { const [t, s] = b.dataset.start.split('|'); startTake(t, s, document.getElementById('timed').checked, null, document.getElementById('fb').checked); });
  if (prog) {
    document.getElementById('resume').onclick = () => startTake(prog.testId, prog.sectionId, prog.timed, prog, !!prog.feedback);
    document.getElementById('discard').onclick = () => { LS.del(KEY.progress); viewHome(); };
  }
}

/* ---------------- take ---------------- */
async function startTake(testId, sectionId, timed, resume, feedback) {
  const data = await api(`/api/tests/${encodeURIComponent(testId)}/sections/${encodeURIComponent(sectionId)}`);
  const limit = timed && data.section.timeLimitMin ? data.section.timeLimitMin * 60 : null;
  S.take = { testId, sectionId, data, limit, timed, feedback: !!feedback, answers: {}, flags: {}, times: {}, idx: 0, elapsed: 0, startedAt: new Date().toISOString(), shownGroup: null };
  if (resume) Object.assign(S.take, { answers: resume.answers, flags: resume.flags, times: resume.times, idx: Math.min(resume.idx, data.questions.length - 1), elapsed: resume.elapsed, startedAt: resume.startedAt });
  saveProgress();
  if (location.hash === '#/take') route(); else location.hash = '#/take';
}
function saveProgress() {
  const t = S.take; if (!t) return;
  if (!Object.keys(t.answers).length) { LS.del(KEY.progress); return; }   // nothing answered: not worth resuming
  LS.set(KEY.progress, { testId: t.testId, sectionId: t.sectionId, testTitle: t.data.test.title, sectionTitle: t.data.section.title, timed: t.timed, feedback: t.feedback,
    answers: t.answers, flags: t.flags, times: t.times, idx: t.idx, elapsed: t.elapsed, startedAt: t.startedAt });
}
function viewTake() {
  const t = S.take, qs = t.data.questions;
  t.shownGroup = null; t.last = Date.now();
  $app.innerHTML = `<div class="takebar"><div><div class="small muted">${esc(t.data.test.title)}</div><b>${esc(t.data.section.title)}</b></div>
      <div><div class="timer" id="timer"></div><div class="small muted" id="timersub"></div></div>
      <div class="grow"><div class="small muted" id="progtxt"></div><div class="bar"><i id="progbar"></i></div></div>
      <button class="primary" id="submit">Submit…</button></div>
    <div class="layout"><div class="card" id="qcard"></div>
      <aside class="card nav"><b>Questions</b><div class="grid" id="grid" style="margin-top:8px"></div>
      <div class="legend"><span>■ answered</span><span>□ not answered</span><span>⚑ flagged</span><span>outline = current</span></div>
      <p class="small muted">Keys: 1–4 answer · ←/→ move · F flag</p></aside></div>`;
  document.getElementById('submit').onclick = confirmSubmit;
  const tick = () => {
    Core.advanceClock(t, Date.now(), qs[t.idx].id);
    updateBar(); if (Core.isTimeUp(t)) submitTake(true);
  };
  const iv = setInterval(tick, 1000), sv = setInterval(saveProgress, 5000);
  const key = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'AUDIO') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= qs[t.idx].choices.length) pick(n);
    else if (e.key === 'ArrowRight') go(t.idx + 1); else if (e.key === 'ArrowLeft') go(t.idx - 1);
    else if (e.key.toLowerCase() === 'f') toggleFlag();
  };
  document.addEventListener('keydown', key);
  S.cleanup = () => { clearInterval(iv); clearInterval(sv); document.removeEventListener('keydown', key); saveProgress(); };
  renderNav(); renderQuestion(); updateBar();
}
function updateBar() {
  const t = S.take, n = t.data.questions.length, a = Object.keys(t.answers).length;
  const el = document.getElementById('timer'); if (!el) return;
  if (t.limit) { const left = t.limit - t.elapsed; el.textContent = fmtTime(left); el.classList.toggle('low', left < 300); document.getElementById('timersub').textContent = 'elapsed ' + fmtTime(t.elapsed) + ' / ' + fmtTime(t.limit); }
  else { el.textContent = fmtTime(t.elapsed); document.getElementById('timersub').textContent = 'untimed'; }
  const flagged = Core.countTrue(t.flags);
  document.getElementById('progtxt').textContent = `${a} / ${n} answered` + (flagged ? ` · ${flagged} flagged` : '');
  document.getElementById('progbar').style.width = (a / n * 100) + '%';
}
function renderNav() {
  const t = S.take;
  document.getElementById('grid').innerHTML = t.data.questions.map((q, i) =>
    `<button data-i="${i}" title="${esc(q.number)}" class="${t.answers[q.id] ? 'answered ' : ''}${i === t.idx ? 'current ' : ''}${t.flags[q.id] ? 'flag' : ''}">${esc(q.number)}</button>`).join('');
  document.getElementById('grid').querySelectorAll('button').forEach((b) => b.onclick = () => go(+b.dataset.i));
}
function go(i) {
  const t = S.take; if (i < 0 || i >= t.data.questions.length) return;
  t.idx = i; renderNav(); renderQuestion(); saveProgress();
}
function pick(n) {
  const t = S.take, q = t.data.questions[t.idx];
  if (t.feedback && t.answers[q.id]) return;   // locked after answering in instant-feedback mode
  if (t.answers[q.id] === n) delete t.answers[q.id]; else t.answers[q.id] = n;   // click again to clear
  renderChoices(); renderNav(); updateBar(); saveProgress();
}
function toggleFlag() { const t = S.take, q = t.data.questions[t.idx]; t.flags[q.id] = !t.flags[q.id]; document.getElementById('flagbtn').textContent = t.flags[q.id] ? '⚑ Flagged' : '⚐ Flag'; renderNav(); updateBar(); }
function renderChoices() {
  const t = S.take, q = t.data.questions[t.idx], g = t.data.groups[q.group] || {};
  const sel = t.answers[q.id];
  const box = document.getElementById('choices');
  if (t.feedback && sel) {
    box.className = 'choices';
    box.innerHTML = '<div class="small muted">🔒 Answer locked</div>' + reviewBody({ ...q, selected: sel, isCorrect: sel === q.answer });
    return;
  }
  box.className = 'choices' + (g.hideChoices ? ' numeric' : '');
  box.innerHTML = q.choices.map((c, i) => `<button class="choice ${sel === i + 1 ? 'sel' : ''}" data-n="${i + 1}"><span class="n">${i + 1}</span>${g.hideChoices ? '' : '<span>' + inl(c) + '</span>'}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => b.onclick = () => pick(+b.dataset.n));
}
function renderQuestion() {
  const t = S.take, qs = t.data.questions, q = qs[t.idx], g = t.data.groups[q.group] || {};
  const prev = t.idx > 0 ? t.data.groups[qs[t.idx - 1].group] : null;
  const card = document.getElementById('qcard');
  if (t.shownGroup !== q.group || !document.getElementById('gbox')) {
    const showHead = !prev || prev.title !== g.title;
    card.innerHTML = '<div id="gbox"></div><div id="qbox"></div>';
    document.getElementById('gbox').innerHTML = groupHtml(g, t.testId, showHead);
    t.shownGroup = q.group;
  } else {
    const head = document.querySelector('#gbox .gh'); if (head) head.style.display = (prev && prev.title === g.title) ? 'none' : '';
  }
  const hide = g.hideChoices;
  document.getElementById('qbox').innerHTML = `<div class="qhead"><span class="qnum">Q${esc(q.number)}</span><span class="grow"></span>
      <button id="flagbtn">${t.flags[q.id] ? '⚑ Flagged' : '⚐ Flag'}</button></div>
    ${promptHtml(q.prompt)}
    ${hide ? '<div class="muted small">Audio-only question: choices are not printed. Choose the number you heard.</div>' : ''}
    <div id="choices"></div>
    <div class="row" style="margin-top:14px"><button id="prev" ${t.idx === 0 ? 'disabled' : ''}>← Previous</button><span class="grow"></span>
      <span class="muted small">${t.idx + 1} / ${qs.length}</span><span class="grow"></span>
      ${t.idx < qs.length - 1 ? '<button id="next" class="primary">Next →</button>' : '<button id="fin" class="primary">Finish & submit…</button>'}</div>`;
  renderChoices();
  document.getElementById('flagbtn').onclick = toggleFlag;
  document.getElementById('prev').onclick = () => go(t.idx - 1);
  const nx = document.getElementById('next'); if (nx) nx.onclick = () => go(t.idx + 1);
  const fn = document.getElementById('fin'); if (fn) fn.onclick = confirmSubmit;
}
function groupHtml(g, testId, showHead) {
  return `${showHead && g.title ? `<div class="gh"><b>${esc(g.title)}</b><span class="small">${fmt(g.instructions)}</span></div>` : ''}
    ${g.audio ? `<audio controls preload="metadata" src="${mediaUrl(testId, g.audio)}"></audio>` : ''}
    ${g.passage ? `<div class="passage">${fmt(g.passage)}</div>` : ''}`;
}
function confirmSubmit() {
  const t = S.take, qs = t.data.questions, un = qs.filter((q) => !t.answers[q.id]).length, fl = qs.filter((q) => t.flags[q.id]).length;
  const m = modal(`<h2 style="margin-top:0">Submit this section?</h2>
    <p>${un ? `<b style="color:var(--bad)">${un} unanswered</b> question${un > 1 ? 's' : ''}.` : 'All questions answered.'}${fl ? ` ${fl} flagged for review.` : ''}</p>
    <p class="small muted">Time used: ${fmtTime(t.elapsed)}${t.limit ? ' of ' + fmtTime(t.limit) : ''}</p>
    <div class="row"><button id="mgo">Keep working</button><span class="grow"></span><button class="primary" id="mok">Submit</button></div>`);
  m.querySelector('#mgo').onclick = closeModal; m.querySelector('#mok').onclick = () => submitTake(false);
}
async function submitTake(timedOut) {
  const t = S.take; if (!t || t.submitting) return; t.submitting = true;
  if (S.cleanup) { S.cleanup(); S.cleanup = null; }
  const result = Core.buildResult(t, timedOut, new Date().toISOString());
  try {
    const r = await api('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
    LS.del(KEY.progress); S.take = null; location.hash = '#/result/' + encodeURIComponent(r.id);
  } catch (e) { t.submitting = false; modal(`<b>Could not save the result</b><pre>${esc(e.message)}</pre><button id="x">Close</button>`).querySelector('#x').onclick = closeModal; }
}

/* ---------------- result review ---------------- */
async function viewResult(id) {
  const r = await api('/api/results/' + encodeURIComponent(id));
  let filter = 'all';
  const draw = () => {
    $app.innerHTML = `<div class="row"><a href="#/history">← History</a></div><h1>Result</h1><div class="muted small">${fmtDate(r.finishedAt)}</div>` +
      r.sections.map((s, si) => {
        const wrong = s.questions.filter((q) => q.selected && !q.isCorrect).length, blank = s.questions.filter((q) => !q.selected).length;
        const fl = s.questions.filter((q) => q.flagged).length;
        return `<div class="card"><div class="row"><div class="grow"><div class="muted small">${esc(s.testTitle)}</div><h2 style="margin:0">${esc(s.sectionTitle)}</h2></div>
          <div><div class="score-big">${s.score.correct}<span class="muted" style="font-size:24px">/${s.score.total}</span></div><span class="pill ${pctClass(s.score.percent)}">${s.score.percent}%</span></div></div>
          <div class="stats" style="margin:12px 0 0"><div class="stat"><span class="muted small">Time</span><b>${fmtTime(s.elapsedSec)}</b><span class="small muted">${s.timeLimitSec ? 'of ' + fmtTime(s.timeLimitSec) : 'untimed'}${s.timedOut ? ' · time up' : ''}</span></div>
          <div class="stat"><span class="muted small">Wrong</span><b>${wrong}</b></div><div class="stat"><span class="muted small">Unanswered</span><b>${blank}</b></div>
          <div class="stat"><span class="muted small">Avg per question</span><b>${fmtTime(s.elapsedSec / s.questions.length)}</b></div></div>
          <div class="row filters" style="margin-top:12px" data-si="${si}">${[['all', 'All'], ['wrong', 'Wrong'], ['blank', 'Unanswered'], ['flag', 'Flagged (' + fl + ')']].map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}
          <span class="grow"></span><button data-retake="${esc(s.testId)}|${esc(s.sectionId)}">Retake</button></div></div>` + reviewList(s, filter);
      }).join('');
    $app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { filter = b.dataset.f; draw(); });
    $app.querySelectorAll('[data-retake]').forEach((b) => b.onclick = () => { const [t, s] = b.dataset.retake.split('|'); startTake(t, s, LS.get(KEY.timed, true), null, LS.get(KEY.feedback, false)); });
  };
  draw();
}
function reviewBody(q) {
  return `${q.choices.map((c, i) => { const n = i + 1, ok = n === q.answer, no = q.selected === n && !ok;
        return `<div class="choice ${ok ? 'ok' : ''} ${no ? 'no' : ''}"><span class="n">${n}</span><span class="grow">${inl(c)}${q.selected === n ? ' <span class="small muted">← your answer</span>' : ''}${ok ? ' <span class="small" style="color:var(--good)">✔ correct</span>' : ''}</span></div>
        ${q.why && q.why[i] ? `<div class="why">${inl(q.why[i])}</div>` : ''}`; }).join('')}
      ${q.explanation ? `<div class="expl"><b>Explanation:</b> ${fmt(q.explanation)}</div>` : ''}
      ${q.transcript ? `<details open><summary>Audio transcript</summary><div class="transcript">${fmt(q.transcript)}</div></details>` : ''}`;
}
function reviewList(s, filter) {
  const keep = (q) => filter === 'all' || (filter === 'wrong' && q.selected && !q.isCorrect) || (filter === 'blank' && !q.selected) || (filter === 'flag' && q.flagged);
  let prevGroup = null, prevTitle = null, html = '';
  for (const q of s.questions) {
    if (!keep(q)) continue;
    const g = s.groups[q.group] || {};
    const newGroup = q.group !== prevGroup;
    const status = !q.selected ? '<span class="pill warn">unanswered</span>' : q.isCorrect ? '<span class="pill good">correct</span>' : '<span class="pill bad">wrong</span>';
    html += `<div class="card">${newGroup ? groupHtml(g, s.testId, g.title !== prevTitle) : ''}
      <div class="qhead"><span class="qnum">Q${esc(q.number)}</span>${status}${q.flagged ? '<span class="pill warn">⚑</span>' : ''}<span class="grow"></span><span class="muted small">${q.timeSec}s</span></div>
      ${promptHtml(q.prompt)}
      ${reviewBody(q)}</div>`;
    prevGroup = q.group; prevTitle = g.title;
  }
  return html || '<div class="card muted">Nothing to show for this filter.</div>';
}

/* ---------------- history ---------------- */
async function viewHistory() {
  const results = await api('/api/results');
  const rows = [];
  for (const r of results) for (const s of r.sections) rows.push({ r, s });
  const tests = [...new Set(rows.map((x) => x.s.testTitle))];
  let ft = 'all';
  const draw = () => {
    const list = rows.filter((x) => ft === 'all' || x.s.testTitle === ft);
    const avg = list.length ? Math.round(list.reduce((a, x) => a + x.s.score.percent, 0) / list.length) : 0;
    const total = list.reduce((a, x) => a + x.s.elapsedSec, 0);
    $app.innerHTML = `<h1>History</h1>
      <div class="stats"><div class="stat"><span class="muted small">Attempts</span><b>${list.length}</b></div><div class="stat"><span class="muted small">Average score</span><b>${avg}%</b></div>
      <div class="stat"><span class="muted small">Total study time</span><b>${fmtTime(total)}</b></div></div>
      <div class="row" style="margin-bottom:10px"><label class="small">Test <select id="ft"><option value="all">All</option>${tests.map((t) => `<option ${t === ft ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
      ${list.length ? `<div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Date</th><th>Test / section</th><th>Score</th><th>Time</th><th></th></tr></thead><tbody>
      ${list.map(({ r, s }) => `<tr><td>${fmtDate(r.finishedAt)}</td><td>${esc(s.sectionTitle)}<div class="muted small">${esc(s.testTitle)}</div></td><td>${scorePill(s.score)}</td>
        <td>${fmtTime(s.elapsedSec)}${s.timeLimitSec ? ' / ' + fmtTime(s.timeLimitSec) : ''}${s.timedOut ? ' <span class="pill bad">time up</span>' : ''}</td>
        <td style="white-space:nowrap"><a href="#/result/${encodeURIComponent(r.id)}"><button>Open</button></a> <button class="danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">No attempts yet. Take a section from the Tests page.</div>'}`;
    const sel = document.getElementById('ft'); if (sel) sel.onchange = () => { ft = sel.value; draw(); };
    $app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this result permanently?')) return;
      await api('/api/results/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
      const i = results.findIndex((x) => x.id === b.dataset.del); if (i >= 0) results.splice(i, 1);
      rows.length = 0; for (const r of results) for (const s of r.sections) rows.push({ r, s }); draw();
    });
  };
  draw();
}

route();
