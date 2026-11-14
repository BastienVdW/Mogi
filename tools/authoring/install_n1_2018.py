"""Build the 'JLPT N1 2018 sample' test into the N1Trainer data dir (default %APPDATA%\\N1Trainer).
Run:  python install_n1_2018.py   (needs tools/source/jlpt-n1-2018-sample, see tools/extract)"""
import os, shutil
from lib import *
import n1_2018_vocab, n1_2018_grammar, n1_2018_reading, n1_2018_listening

T = 'jlpt-n1-2018-sample'
SRC = os.path.join(os.path.dirname(__file__), '..', 'source', 'jlpt-n1-2018-sample')

write_section(T, 'vocab', n1_2018_vocab.groups, n1_2018_vocab.qs)
write_section(T, 'grammar', n1_2018_grammar.groups, n1_2018_grammar.qs)
write_section(T, 'reading', n1_2018_reading.groups, n1_2018_reading.qs)
g, q = n1_2018_listening.build()
write_section(T, 'listening', g, q)

write_manifest(T, {
    'schemaVersion': 1,
    'id': T,
    'title': 'JLPT N1 Official Sample (2018 revised)',
    'level': 'N1',
    'published': '2018',
    'source': 'https://www.jlpt.jp/e/samples/sampleindex.html',
    'description': 'Official sample questions published by JEES / Japan Foundation. Explanations are added by this project.',
    'sections': [
        {'id': 'vocab', 'title': 'Language Knowledge: Vocabulary (文字・語彙)', 'file': 'sections/vocab.csv', 'groups': 'sections/vocab.groups.csv', 'timeLimitMin': 25, 'type': 'text'},
        {'id': 'grammar', 'title': 'Language Knowledge: Grammar (文法)', 'file': 'sections/grammar.csv', 'groups': 'sections/grammar.groups.csv', 'timeLimitMin': 25, 'type': 'text'},
        {'id': 'reading', 'title': 'Reading (読解)', 'file': 'sections/reading.csv', 'groups': 'sections/reading.groups.csv', 'timeLimitMin': 60, 'type': 'text'},
        {'id': 'listening', 'title': 'Listening (聴解)', 'file': 'sections/listening.csv', 'groups': 'sections/listening.groups.csv', 'timeLimitMin': 60, 'type': 'audio'},
    ]})

adir = os.path.join(data_dir(), 'tests', T, 'audio')
os.makedirs(adir, exist_ok=True)
for i in range(1, 6):
    shutil.copyfile(os.path.join(SRC, f'N1Q{i}.mp3'), os.path.join(adir, f'N1Q{i}.mp3'))
print('installed to', os.path.join(data_dir(), 'tests', T))
