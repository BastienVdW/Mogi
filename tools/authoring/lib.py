"""Helpers to write a test section as CSV into the N1Trainer data dir (outside the app).

Markup used inside text fields (prompt / passage / explanation / transcript):
  __text__   underline            [[text]]  highlight
  {n}        blank marker (reading comprehension), shown as a boxed number
  lines starting with '|' form a table (cells split by '|')
"""
import csv, json, os, re, sys


def data_dir():
    return os.environ.get('N1_DATA_DIR') or os.path.join(
        os.environ.get('APPDATA') or os.path.expanduser('~/.config'), 'N1Trainer')


Q_COLS = ['id', 'group', 'number', 'prompt', 'choice1', 'choice2', 'choice3', 'choice4', 'answer',
          'explanation', 'why1', 'why2', 'why3', 'why4', 'transcript', 'audio_start']
G_COLS = ['id', 'title', 'instructions', 'passage', 'audio', 'hide_choices']


def Q(id, group, number, prompt, choices, answer, explanation, why, transcript='', audio_start=''):
    assert 1 <= answer <= len(choices), id
    assert len(choices) in (3, 4) and len(why) == len(choices), (id, len(why))
    ch = list(choices) + [''] * (4 - len(choices))
    wy = list(why) + [''] * (4 - len(why))
    return dict(id=id, group=group, number=number, prompt=prompt,
                choice1=ch[0], choice2=ch[1], choice3=ch[2], choice4=ch[3],
                answer=answer, explanation=explanation,
                why1=wy[0], why2=wy[1], why3=wy[2], why4=wy[3],
                transcript=transcript, audio_start=audio_start)


def G(id, title, instructions='', passage='', audio='', hide_choices=''):
    return dict(id=id, title=title, instructions=instructions, passage=passage,
                audio=audio, hide_choices=hide_choices)


def _write(path, cols, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, '') for c in cols})


def write_section(test_id, section_id, groups, questions):
    base = os.path.join(data_dir(), 'tests', test_id, 'sections')
    gids = {g['id'] for g in groups}
    for q in questions:
        assert q['group'] in gids, q['id']
    assert len({q['id'] for q in questions}) == len(questions)
    _write(os.path.join(base, section_id + '.groups.csv'), G_COLS, groups)
    _write(os.path.join(base, section_id + '.csv'), Q_COLS, questions)
    print(section_id, len(questions), 'questions ->', base)


def write_manifest(test_id, manifest):
    p = os.path.join(data_dir(), 'tests', test_id, 'test.json')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(manifest, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
