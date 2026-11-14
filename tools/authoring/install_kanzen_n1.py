"""Install the Kanzen Moshi N1 mock tests (J-Research, 1st printing 2012-11) into the N1Trainer data dir.

Run:  python install_kanzen_n1.py [1 2 3]

Needs (all git-ignored, under tools/source/, see tools/source/README.md):
  a folder holding km<N>.json  (extracted question data)
  a folder holding the book's audio CD<N> as Track<NN>.mp3
"""
import glob, json, os, shutil, sys
from lib import *

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source')
PUBLISHED = '2012-11'

# listening audio: (mondai, question) -> track number on CD<N>
TRACKS = {}
for i in range(1, 7): TRACKS[(1, i)] = 3 + i
for i in range(1, 8): TRACKS[(2, i)] = 11 + i
for i in range(1, 7): TRACKS[(3, i)] = 21 + i
for i in range(1, 14): TRACKS[(4, i)] = 29 + i
TRACKS[(5, 1)] = 44; TRACKS[(5, 2)] = 45; TRACKS[(5, 3)] = 47

I_CHOOSE = '1・2・3・4から最もよいものを一つ選びなさい。\nChoose the best answer from 1-4.'
INSTR = {
    1: '＿＿＿の言葉の読み方として最もよいものを、' + I_CHOOSE,
    2: '（　　）に入れるのに最もよいものを、' + I_CHOOSE,
    3: '＿＿＿の言葉に意味が最も近いものを、' + I_CHOOSE,
    4: '次の言葉の使い方として最もよいものを、' + I_CHOOSE,
    5: '次の文の（　　）に入れるのに最もよいものを、' + I_CHOOSE,
    6: '次の文の ★ に入る最もよいものを、' + I_CHOOSE + '\nChoose the word that goes in the ★ position of the correctly ordered sentence.',
    7: '次の文章を読んで、文章全体の趣旨を考えて、41から45の中に入る最もよいものを、' + I_CHOOSE,
    8: '次の文章を読んで、後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
    9: '次の文章を読んで、後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
    10: '次の文章を読んで、後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
    11: '次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
    12: '次の文章を読んで、後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
    13: '右のページは、情報を読み取る問題です。後の問いに対する答えとして最もよいものを、' + I_CHOOSE,
}
M_TITLE = {1: 'Kanji reading', 2: 'Contextual vocabulary', 3: 'Synonyms', 4: 'Word usage',
           5: 'Grammar in context', 6: 'Sentence arrangement (★)', 7: 'Passage grammar'}
L_INSTR = {
    1: 'まず質問を聞いてください。それから話を聞いて、問題用紙の1から4の中から、最もよいものを一つ選んでください。\nListen to the question, then the conversation, and choose the best answer.',
    2: 'まず質問を聞いてください。そのあと、問題用紙のせんたくしを読んでください。それから話を聞いて、最もよいものを一つ選んでください。\nListen to the question, read the choices, then listen and choose the best answer.',
    3: '問題用紙に何も印刷されていません。この問題は、全体としてどんな内容かを聞く問題です。話の前に質問はありません。まず話を聞いてください。それから、質問とせんたくしを聞いて、1から4の中から、最もよいものを一つ選んでください。\nNothing is printed in the booklet. Listen to the talk, then the question and choices.',
    4: '問題用紙に何も印刷されていません。まず文を聞いてください。それから、それに対する返事を聞いて、1から3の中から、最もよいものを一つ選んでください。\nListen to the sentence and choose the best reply.',
    5: '長めの話を聞きます。この問題には練習はありません。メモをとってもかまいません。\nLong passages; no practice. You may take notes.',
}
L_TITLE = {1: 'Task comprehension', 2: 'Point comprehension', 3: 'Gist comprehension', 4: 'Quick response', 5: 'Integrated comprehension'}


def why(ch):
    return [''] * len(ch)


def text_section(S, sec, qs_key, groups, qs, first_m, last_m, m7_passage=None):
    for m in range(first_m, last_m + 1):
        passage = m7_passage if m == 7 else ''
        groups.append(G('m%d' % m, '問題%d %s' % (m, M_TITLE[m]), INSTR[m], passage))
    for q in S[qs_key]:
        qs.append(Q('q%d' % q['n'], 'm%d' % q['m'], str(q['n']), q['prompt'], q['ch'], q['ans'], q['expl'], why(q['ch'])))


def find_one(*parts):
    hits = glob.glob(os.path.join(SRC, *parts))
    if not hits: sys.exit('source not found under tools/source: ' + '/'.join(parts))
    return hits[0]


def build(t):
    T = 'kanzen-moshi-n1-%d' % t
    S = json.load(open(find_one('*', 'km%d.json' % t), encoding='utf8'))
    # vocab
    g, q = [], []
    text_section(S, 'vocab', 'vocab', g, q, 1, 4)
    write_section(T, 'vocab', g, q)
    # grammar
    g, q = [], []
    text_section(S, 'grammar', 'grammar', g, q, 5, 7, S['m7_passage'])
    write_section(T, 'grammar', g, q)
    # reading
    g, q = [], []
    seen = {}
    for grp in S['reading']:
        m = grp['m']; seen[m] = seen.get(m, 0) + 1
        gid = 'r%d%s' % (m, 'abcdefgh'[seen[m] - 1])
        g.append(G(gid, grp['title'], INSTR[m], grp['passage']))
        for x in grp['qs']:
            q.append(Q('q%d' % x['n'], gid, str(x['n']), x['stem'], x['ch'], x['ans'], x['expl'], why(x['ch'])))
    write_section(T, 'reading', g, q)
    # listening
    g, q = [], []
    done = set()
    cd = os.path.dirname(find_one('*', '*AudioCD%d' % t, 'Track01.mp3'))
    adir = os.path.join(data_dir(), 'tests', T, 'audio')
    os.makedirs(adir, exist_ok=True)
    for it in S['listening']:
        m, i = it['m'], it['i']
        ti = (m, min(i, 3)) if m == 5 else (m, i)
        gid = 'l%d-%d' % ti
        if gid not in done:
            done.add(gid)
            g.append(G(gid, '問題%d %s' % (m, L_TITLE[m]), L_INSTR[m], audio='audio/%s.mp3' % gid, hide_choices='1' if m >= 3 else ''))
            shutil.copyfile(os.path.join(cd, 'Track%02d.mp3' % TRACKS[ti]), os.path.join(adir, gid + '.mp3'))
        qid = 'l%d-%d' % (m, i) if not (m == 5 and i >= 3) else 'l5-3' + 'ab'[i - 3]
        num = '%d-%d' % (m, i) if not (m == 5 and i >= 3) else '5-3 質問%d' % (i - 2)
        q.append(Q(qid, gid, num, it['prompt'], it['ch'], it['ans'], it['expl'], why(it['ch']), it['transcript']))
    write_section(T, 'listening', g, q)
    write_manifest(T, {
        'schemaVersion': 1, 'id': T,
        'title': 'JLPT N1 完全模試 (Kanzen Moshi) – Mock Test %d' % t,
        'level': 'N1', 'published': PUBLISHED, 'perChoiceNotes': False,
        'source': 'Kanzen Moshi N1 (J-Research), 1st printing 2012-11',
        'description': 'Mock test %d of 3 from the Kanzen Moshi N1 book. Explanations and scripts come from the book.' % t,
        'sections': [
            {'id': 'vocab', 'title': 'Language Knowledge: Vocabulary (文字・語彙)', 'file': 'sections/vocab.csv', 'groups': 'sections/vocab.groups.csv', 'timeLimitMin': 25, 'type': 'text'},
            {'id': 'grammar', 'title': 'Language Knowledge: Grammar (文法)', 'file': 'sections/grammar.csv', 'groups': 'sections/grammar.groups.csv', 'timeLimitMin': 25, 'type': 'text'},
            {'id': 'reading', 'title': 'Reading (読解)', 'file': 'sections/reading.csv', 'groups': 'sections/reading.groups.csv', 'timeLimitMin': 60, 'type': 'text'},
            {'id': 'listening', 'title': 'Listening (聴解)', 'file': 'sections/listening.csv', 'groups': 'sections/listening.groups.csv', 'timeLimitMin': 60, 'type': 'audio'},
        ]})
    print('installed', T)


if __name__ == '__main__':
    for t in [int(a) for a in sys.argv[1:]] or [1, 2, 3]:
        build(t)
