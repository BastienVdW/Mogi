"""Parse the 2012 N1 listening script (tools/source/jlpt-n1-2012-sample/script_final.txt) into
{mondai: {item_key: raw_text}} with page-number noise removed."""
import os, re

SRC = os.path.join(os.path.dirname(__file__), '..', 'source', 'jlpt-n1-2012-sample', 'script_final.txt')
NUM = {str(i): '０１２３４５６７８９'[i] for i in range(10)}


def clean(t):
    t = re.sub(r'\s(\d{2}) \1(?=\n|$)', '', t)            # duplicated page numbers "62 62" at end of line
    t = re.sub(r'\s(\d{2}) \1\s', '', t)                   # ... or in the middle of a sentence
    t = t.replace('表したら', '表したら')
    t = re.sub(r'(?m)^(\d+) 番', r'\1番', t)
    t = t.replace('３00', '300').replace('Ｓ １ ０ ０', 'Ｓ１００')
    t = re.sub(r'(?<=\d) (?=[年歳％℃から])', '', t)
    t = re.sub(r'(?<=[\d]) (?=[％℃])', '', t)
    t = t.replace('％ を', '％を').replace('℃ か', '℃か').replace('℃ の', '℃の')
    return t


def blocks():
    t = clean(open(SRC, encoding='utf8').read())
    out = {}
    for m in re.finditer(r'^問題([１-５])\s*$(.*?)(?=^問題[１-５]\s*$|\Z)', t, flags=re.M | re.S):
        mondai = '１２３４５'.index(m.group(1)) + 1
        body = m.group(2)
        parts = re.split(r'^(例(?!え)|[０-９0-9]+\s*番)', body, flags=re.M)
        items = {}
        for i in range(1, len(parts), 2):
            key = parts[i]
            if key != '例':
                key = key.replace('番', '').strip()
                key = int(key.translate(str.maketrans('０１２３４５６７８９', '0123456789')))
            items[key] = parts[i + 1].strip()
        out[mondai] = items
    return out


if __name__ == '__main__':
    b = blocks()
    for m, items in b.items():
        for k, v in items.items():
            print('==', m, k, '==')
            print(v)
