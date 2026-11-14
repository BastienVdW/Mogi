r"""Build the 'JLPT N1 2009 sample' test into the N1Trainer data dir (default %APPDATA%\N1Trainer).
Run:  python install_n1_2009.py   (needs tools/source/jlpt-n1-2009-sample, see tools/extract/extract_n1_2009.py)"""
import os, shutil
from lib import *
import n1_2009_vocab, n1_2009_grammar, n1_2009_reading, n1_2009_listening

T = 'jlpt-n1-2009-sample'
SRC = os.path.join(os.path.dirname(__file__), '..', 'source', 'jlpt-n1-2009-sample')

write_section(T, 'vocab', n1_2009_vocab.groups, n1_2009_vocab.qs)
write_section(T, 'grammar', n1_2009_grammar.groups, n1_2009_grammar.qs)
write_section(T, 'reading', n1_2009_reading.groups, n1_2009_reading.qs)
g, q = n1_2009_listening.build()
write_section(T, 'listening', g, q)

write_manifest(T, {
    'schemaVersion': 1,
    'id': T,
    'title': 'JLPT N1 Official Sample (2009, short)',
    'level': 'N1',
    'published': '2009',
    'source': 'https://www.jlpt.jp/e/samples/sample09.html',
    'description': 'Short official sample (34 text + 10 listening questions) from the 2009 announcement of the revised JLPT, same question types as today. Explanations are added by this project.',
    'sections': [
        {'id': 'vocab', 'title': 'Language Knowledge: Vocabulary (文字・語彙)', 'file': 'sections/vocab.csv', 'groups': 'sections/vocab.groups.csv', 'timeLimitMin': 8, 'type': 'text'},
        {'id': 'grammar', 'title': 'Language Knowledge: Grammar (文法)', 'file': 'sections/grammar.csv', 'groups': 'sections/grammar.groups.csv', 'timeLimitMin': 10, 'type': 'text'},
        {'id': 'reading', 'title': 'Reading (読解)', 'file': 'sections/reading.csv', 'groups': 'sections/reading.groups.csv', 'timeLimitMin': 25, 'type': 'text'},
        {'id': 'listening', 'title': 'Listening (聴解)', 'file': 'sections/listening.csv', 'groups': 'sections/listening.groups.csv', 'timeLimitMin': 12, 'type': 'audio'},
    ]})

adir = os.path.join(data_dir(), 'tests', T, 'audio')
os.makedirs(adir, exist_ok=True)
for i in range(1, 6):
    shutil.copyfile(os.path.join(SRC, f'N1L{i}.mp3'), os.path.join(adir, f'N1L{i}.mp3'))
print('installed to', os.path.join(data_dir(), 'tests', T))
