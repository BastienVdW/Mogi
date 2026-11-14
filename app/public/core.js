'use strict';
/* Pure helpers shared by the browser UI (loaded as a global `Core`) and the unit tests (require). No DOM access here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_TICK_SEC = 5;   // a single timer tick never adds more than this, so a sleeping/hidden tab does not burn the clock
  const BLANK_ONLY = /^\{\d+\}$/;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* inline markup: __underline__  [[highlight]]  {41} blank box  **bold** */
  function inl(s) {
    return esc(s).replace(/__(.+?)__/g, '<u>$1</u>').replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>')
      .replace(/\{(\d+(?:-[ab])?)\}/g, '<span class="blank">$1</span>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  /* multi-line text; consecutive lines starting with | become a table (first row = header) */
  function fmt(text) {
    let html = '', tbl = [];
    const flush = () => {
      if (!tbl.length) return;
      html += '<table class="tbl">' + tbl.map((r, i) => { const tag = i ? 'td' : 'th'; return '<tr>' + r.map((c) => `<${tag}>${inl(c)}</${tag}>`).join('') + '</tr>'; }).join('') + '</table>';
      tbl = [];
    };
    for (const l of String(text || '').split('\n')) {
      if (l.startsWith('|')) { tbl.push(l.replace(/^\||\|$/g, '').split('|')); continue; }
      flush(); html += inl(l) + '<br>';
    }
    flush();
    return html;
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  const pctClass = (p) => (p >= 60 ? 'good' : p >= 40 ? 'warn' : 'bad');

  /* prompt block; a prompt that is only a blank marker like {41} is shown as "Blank 41" */
  function promptHtml(prompt) {
    if (!prompt) return '';
    return `<div class="prompt">${BLANK_ONLY.test(prompt) ? 'Blank ' : ''}${fmt(prompt)}</div>`;
  }

  /* Advance the section clock to `nowMs`. Mutates take.{elapsed,times,last}; returns the seconds added. */
  function advanceClock(take, nowMs, questionId) {
    const d = Math.max(0, Math.min((nowMs - take.last) / 1000, MAX_TICK_SEC));
    take.last = nowMs;
    take.elapsed += d;
    take.times[questionId] = (take.times[questionId] || 0) + d;
    return d;
  }

  const isTimeUp = (take) => !!take.limit && take.elapsed >= take.limit;
  const countTrue = (obj) => Object.values(obj).filter(Boolean).length;

  /* Build the result document for one finished section. `take` is the in-memory attempt state. */
  function buildResult(take, timedOut, nowIso) {
    const d = take.data, used = new Set(d.questions.map((q) => q.group)), groups = {};
    for (const id of used) {
      const g = d.groups[id];
      if (g) groups[id] = { title: g.title, instructions: g.instructions, passage: g.passage, audio: g.audio, hideChoices: g.hideChoices };
    }
    const questions = d.questions.map((q) => {
      const sel = take.answers[q.id] || null;
      return { id: q.id, number: q.number, group: q.group, prompt: q.prompt, choices: q.choices, answer: q.answer, selected: sel, isCorrect: sel === q.answer,
        flagged: !!take.flags[q.id], timeSec: Math.round(take.times[q.id] || 0), explanation: q.explanation, why: q.why, transcript: q.transcript };
    });
    const correct = questions.filter((q) => q.isCorrect).length;
    return { schemaVersion: 1, createdAt: take.startedAt, finishedAt: nowIso, sections: [{
      testId: take.testId, testTitle: d.test.title, sectionId: take.sectionId, sectionTitle: d.section.title, type: d.section.type,
      timeLimitSec: take.limit, elapsedSec: Math.round(take.elapsed), timedOut: !!timedOut,
      score: { correct, total: questions.length, answered: questions.filter((q) => q.selected).length, percent: questions.length ? Math.round(correct / questions.length * 100) : 0 },
      groups, questions }] };
  }

  return { MAX_TICK_SEC, esc, inl, fmt, fmtTime, pctClass, promptHtml, advanceClock, isTimeUp, countTrue, buildResult };
});
