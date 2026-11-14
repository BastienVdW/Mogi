# Mogi: JLPT N1 practice trainer

A small, dependency-free app (Node.js 18+, no `npm install`) for practising the JLPT N1
from official sample tests. Run a section with a timer, review every question with
per-choice explanations, and keep a history of your attempts.

## Features

- Take each section separately (vocabulary, grammar, reading, listening) with an optional timer.
- Question navigator, progress bar, flagging, keyboard shortcuts (1-4, left/right, F), resume after reload.
- Optional **instant feedback**: reveal the real answer and explanations right after answering, and lock the answer.
- Audio playback for listening sections, with transcripts and highlighted key phrases in the review.
- History of attempts (date, time taken, score). Open one to see every question, your pick, the correct answer and the explanations.
- Sections from different tests can be mixed: results store a full snapshot of the questions.

## Quick start

```
N1Trainer.cmd          # Windows launcher
# or
cd app && node server.js [--port 4821] [--data DIR] [--no-open]
```

The browser opens at <http://127.0.0.1:4821>.

## Where things live

| What | Where |
|---|---|
| App code | `app/` |
| Tests and results (your data) | `%APPDATA%\N1Trainer` (or `~/.config/N1Trainer`; override with `N1_DATA_DIR` or `--data`) |
| Extraction and authoring tools | `tools/` |
| Downloaded official material | `tools/source/` (not in the repo, see its README) |

**This repository ships no test content.** The official questions and audio are
copyrighted, so you add them yourself: see [`tools/source/README.md`](tools/source/README.md).

## Data format

```
<data dir>/tests/<test-id>/test.json
                          /sections/<section>.csv          questions
                          /sections/<section>.groups.csv   shared instructions, passages, audio
                          /audio/*.mp3
<data dir>/results/<result-id>.json                        self-contained attempt snapshot
```

`test.json`: `{schemaVersion, id, title, level, source, description, sections:[{id, title, file, groups, timeLimitMin, type}]}` where `type` is `text` or `audio`.

Questions CSV (UTF-8, BOM ok):
`id,group,number,prompt,choice1..4,answer,explanation,why1..4,transcript,audio_start`

Groups CSV: `id,title,instructions,passage,audio,hide_choices`
(`hide_choices=1` shows only numbers during the test and reveals the choices in review.)

Text markup: `__x__` underline, `[[x]]` highlight, `**x**` bold, `{n}` / `{43-a}` boxed blank, lines starting with `|` are table rows.

## Tests

```
cd app && npm test
```

Covers the CSV parser, the HTTP API (tests, sections, results, Range requests, blocked
csv/json and path traversal) and a structural check of every test installed in your data
folder (answers in range, groups exist, explanations present, audio files exist).

## License

MIT, see `LICENSE`. The JLPT sample materials remain the property of JEES / Japan Foundation.
