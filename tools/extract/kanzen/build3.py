import sys, json, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import key3
from d3_vocab import V
from d3_gram import G, M7_PASSAGE
import d3_expl, d3_expl2
from d3_read_a import R8
from d3_read_b import R9a
from d3_read_c import R9b, R10
from d3_read_d import R11, R12
import d3_rexp_a as ra, d3_rexp_b as rb
from d3_lis_a import LA
from d3_lis_b import LB

T = key3._t
E = {}; E.update(d3_expl.E); E.update(d3_expl2.E)

def items(D):
    out = []
    for n in sorted(D):
        m, prompt, ch = D[n]
        out.append(dict(n=n, m=m, prompt=prompt, ch=ch, ans=T[n-1], expl=E[n]))
    return out
vocab = items(V); grammar = items(G)
assert [x['n'] for x in vocab] == list(range(1, 26)), 'vocab nums'
assert [x['n'] for x in grammar] == list(range(26, 46)), 'gram nums'

TOP = dict(ra.TITLES); TOP.update(rb.TITLES2)
RX = dict(ra.RE); RX.update(rb.RE2)
TOPIC = {'11': '在宅リハビリ（AとB）', '13': '学生アルバイト情報'}
reading = []
for grp in R8 + R9a + R9b + R10 + R11 + R12 + rb.R13:
    m = grp['m']; t = grp['title'].strip()
    if t.startswith('('):
        k = t.strip('()'); topic = TOP[f'{m}-{k}']; title = f'問題{m} {t} {topic}'
    else:
        topic = TOPIC.get(str(m), TOP[str(m)]); title = f'問題{m} {topic}'
    qs = []
    for q in grp['qs']:
        n = q['n']
        qs.append(dict(n=n, stem=q['stem'], ch=q['ch'], ans=T[n-1], expl=RX[n]))
    reading.append(dict(m=m, title=title, passage=grp['passage'], qs=qs))
assert [q['n'] for g in reading for q in g['qs']] == list(range(46, 72)), 'reading nums'

def norm(s):
    return s.replace('〜', '～')
def box(expl, ans):
    expl = norm(expl).strip()
    if not expl:
        return f'正答：{ans}'
    out = []; vocab = False
    for ln in expl.split('\n'):
        if ln.strip() == '言葉と表現':
            vocab = True; out.append(ln); continue
        out.append(('□' + ln) if vocab and not ln.startswith('□') else ln)
    return '\n'.join(out)
def clean(tr):
    return '\n'.join(x.lstrip('　') for x in norm(tr).split('\n') if x.strip())

listening = []
for it in LA + LB:
    m, i = it['m'], it['i']
    ans = key3.LIS[m][i-1]
    tr = clean(it['transcript']); ch = [norm(c) for c in it['ch']]; prompt = it['prompt']
    numbered = '\n'.join(f'{k+1} {c}' for k, c in enumerate(ch))
    if m in (1, 2):
        q = tr.split('\n')[-1]
        prompt = (prompt + '\n' + q) if prompt != '（音声を聞いて答えてください）' else q
    elif m == 3 or (m == 5 and i in (1, 2)):
        tr = tr + '\n' + numbered
    elif m == 5:  # i in 3,4: shared transcript, both questions at the end
        body = '\n'.join(l for l in tr.split('\n') if not l.startswith('質問'))
        tr = body + '\n質問1\n男の人は何のリサイクルをすることにしましたか。\n質問2\n女の人は何のリサイクルをすることにしましたか。'
    listening.append(dict(m=m, i=i, prompt=norm(prompt), ch=ch, transcript=tr, expl=box(it['expl'], ans), ans=ans))
cnt = {m: sum(1 for x in listening if x['m'] == m) for m in range(1, 6)}
assert cnt == {1: 6, 2: 7, 3: 6, 4: 13, 5: 4}, cnt

out = dict(vocab=vocab, grammar=grammar, m7_passage=M7_PASSAGE, reading=reading, listening=listening)
dst = r'C:\projects\Mogi_repo\tools\source\kanzen_n1\km3.json'
json.dump(out, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('wrote', dst, len(vocab), len(grammar), len(reading), len(listening))
