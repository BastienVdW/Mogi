"""Download the JLPT N1 2012 sample PDFs/audio and dump text (needs: pip install pymupdf).
Usage: python extract_n1_2012.py   (writes into ../source/jlpt-n1-2012-sample)
The furigana (ruby, font size ~4.5) is dropped from the listening script."""
import os, re, urllib.request, pymupdf
BASE = 'https://www.jlpt.jp/samples/sample2012'
OUT = os.path.join(os.path.dirname(__file__), '..', 'source', 'jlpt-n1-2012-sample')
os.makedirs(OUT, exist_ok=True)
def get(url, dst):
    if not os.path.exists(dst): urllib.request.urlretrieve(url, dst)
for n in 'G L R V answer script sheet'.split(): get(f'{BASE}/pdf/N1{n}.pdf', f'{OUT}/N1{n}.pdf')
for i in range(1, 6): get(f'{BASE}/mp3/N1Q{i}.mp3', f'{OUT}/N1Q{i}.mp3')
for n in 'G L R V answer sheet'.split():
    d = pymupdf.open(f'{OUT}/N1{n}.pdf'); open(f'{OUT}/{n}.txt', 'w', encoding='utf8').write(''.join(p.get_text() for p in d))
d = pymupdf.open(f'{OUT}/N1script.pdf'); out = []
for p in d:
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l['spans'] if s['size'] > 6)
            if t.strip() and not t.startswith('聴解スクリプト'): out.append(t.strip())
t = '\n'.join(out)
t = re.sub(r'\n(?![ＭＦ]\s*[:：]|問題|例|\d+\s*番)', ' ', t)
cjk = r'[　-ヿ一-鿿々！？。、「」（）]'
for _ in range(3): t = re.sub('(?<=%s) (?=%s)' % (cjk, cjk), '', t)
t = re.sub(r'(?<=[ぁ-んー。？]) \d{1,2}$', '', t, flags=re.M)
t = re.sub(r'\s*[：]\s*', '：', t)
open(f'{OUT}/script_final.txt', 'w', encoding='utf8').write(t)
