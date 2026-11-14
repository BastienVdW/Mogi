# Source material (not included)

This folder is intentionally empty in the repository. The JLPT sample questions and
audio are copyrighted by the Japan Educational Exchanges and Services (JEES) and the
Japan Foundation, so they are **not** redistributed here. Everything under
`tools/source/` except this README is git-ignored.

## Adding a source

Each test lives in its own sub-folder named after the test id:

```
tools/source/
  jlpt-n1-2018-sample/
    N1V.pdf  N1G.pdf  N1R.pdf  N1L.pdf     # vocabulary, grammar, reading, listening questions
    N1answer.pdf  N1script.pdf  N1sheet.pdf # answer key, listening script, answer sheet
    N1Q1.mp3 ... N1Q5.mp3                   # listening audio, one file per mondai
    *.txt                                   # text dumps produced by the extractor
```

### 1. Download

Official samples: <https://www.jlpt.jp/e/samples/sampleindex.html>

Either download the PDFs and MP3s into `tools/source/<test-id>/` by hand, or run an
extractor (needs `pip install pymupdf`):

```
python tools/extract/extract_n1_2018.py
python tools/extract/extract_n1_2012.py
```

They download the files and dump the PDF text next to them. Note that the 2012
question PDFs are scanned images, so there is no text layer: read them from the page
images (the 2012 extractor renders them to `pages/`).

### 2. Turn the source into a test

The question text, answers and explanations are authored as Python modules in
`tools/authoring/` (see `lib.py` for the helpers `Q`, `G`, `write_section` and
`write_manifest`, and for the text markup). Those modules contain the official
questions, so they are git-ignored too. Create your own per test, for example
`n1_2018_vocab.py`, `n1_2018_grammar.py`, `n1_2018_reading.py` and
`n1_2018_listening.py`, plus an `install_<test>.py` modelled on
`install_n1_2018.py`.

### 3. Install

```
python tools/authoring/install_n1_2018.py
```

This writes the test (CSVs, manifest, audio) to `%APPDATA%\N1Trainer\tests\<test-id>\`,
where the app picks it up. Set `N1_DATA_DIR` to use another folder.

You can also write the CSV files by hand. The format is documented in the main README.
