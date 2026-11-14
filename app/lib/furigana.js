'use strict';
/* Server-side furigana: adds 漢字《かんじ》 readings (rendered as ruby by the UI) using kuromoji. Optional: if kuromoji is missing, text is returned unchanged. */
const path = require('path');
const KANJI = /[一-鿿々〆ヶ]/;
const isKana = (c) => /[぀-ゟ゠-ヿ]/.test(c);
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

let tk = null;
function init() {
  return new Promise((ok) => {
    let kuromoji; try { kuromoji = require('kuromoji'); } catch (e) { console.warn('furigana disabled (npm install kuromoji):', e.message); return ok(false); }
    kuromoji.builder({ dicPath: path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict') }).build((err, t) => {
      if (err) { console.warn('furigana disabled:', err.message); return ok(false); }
      tk = t; ok(true);
    });
  });
}

/* One token -> text with the reading attached to the kanji part only (okurigana left outside the ruby). */
function annotateToken(surface, reading) {
  if (!KANJI.test(surface) || !reading) return surface;
  const r = toHira(reading);
  if (r === surface) return surface;
  let pre = 0, suf = 0;
  while (pre < surface.length && isKana(surface[pre]) && r[pre] === toHira(surface[pre])) pre++;
  while (suf < surface.length - pre && isKana(surface[surface.length - 1 - suf]) && r[r.length - 1 - suf] === toHira(surface[surface.length - 1 - suf]) && suf < r.length - pre - 1) suf++;
  const kanji = surface.slice(pre, surface.length - suf), yomi = r.slice(pre, r.length - suf);
  if (!kanji || !yomi || !KANJI.test(kanji)) return surface;
  return surface.slice(0, pre) + kanji + '《' + yomi + '》' + surface.slice(surface.length - suf);
}

function annotate(text) {
  if (!tk || !text || typeof text !== 'string' || text.includes('《') || !KANJI.test(text)) return text;
  return text.split('\n').map((line) => KANJI.test(line) ? tk.tokenize(line).map((t) => annotateToken(t.surface_form, t.reading)).join('') : line).join('\n');
}

module.exports = { init, annotate, annotateToken };
