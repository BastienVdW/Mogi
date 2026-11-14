"""Download the JLPT N1 2009 sample PDFs/audio, render the PDF pages to PNG and split the audio by mondai.
Needs: pip install pymupdf, and ffmpeg on PATH.   Usage: python extract_n1_2009.py
The 2009 PDFs are scanned images (no text layer): read the questions from pages/*.png
(M = questions, S = listening script, A = answer key). The single 10-minute MP3 is cut into
N1L1..N1L5.mp3 (one per listening mondai) at the pauses between mondai."""
import os, subprocess, urllib.request, pymupdf
BASE = 'https://www.jlpt.jp/e/samples'
OUT = os.path.join(os.path.dirname(__file__), '..', 'source', 'jlpt-n1-2009-sample')
os.makedirs(OUT + '/pages', exist_ok=True)
def get(url, dst):
    if not os.path.exists(dst): urllib.request.urlretrieve(url, dst)
for n in 'mondai script seikai kaitou'.split(): get(f'{BASE}/pdf/N1-{n}.pdf', f'{OUT}/N1-{n}.pdf')
get(f'{BASE}/mp3/N1Sample.mp3', f'{OUT}/N1Sample.mp3')
for n, pre in [('mondai', 'M'), ('script', 'S'), ('seikai', 'A'), ('kaitou', 'K')]:
    for i, p in enumerate(pymupdf.open(f'{OUT}/N1-{n}.pdf')):
        p.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).save(f'{OUT}/pages/{pre}{i + 1:02d}.png')
CUTS = [(1, 0, 139.0), (2, 139.0, 275.5), (3, 275.5, 433.0), (4, 433.0, 480.0), (5, 480.0, None)]   # seconds
for n, a, b in CUTS:
    dst = f'{OUT}/N1L{n}.mp3'
    if os.path.exists(dst): continue
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/N1Sample.mp3', '-ss', str(a)] + (['-to', str(b)] if b else []) + ['-c', 'copy', dst]
    subprocess.run(cmd, check=True)
