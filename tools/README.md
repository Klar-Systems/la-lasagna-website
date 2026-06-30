# Verification & build tools

Helper scripts used to build and verify the mirror against the live site
(https://www.lalasagnahelsinki.com). Require Python with `playwright`
(`pip install playwright && playwright install chromium`), `Pillow`, `numpy`,
and a local Chrome. Run a local server first: `python -m http.server 8099`
from the site root, then open `http://127.0.0.1:8099/index.html`.

- **compare.py** — renders local vs live full-page for each page and stitches
  side-by-side comparison PNGs + scaled overviews (`OV_<page>.png`). The core
  visual-diff tool. Usage: `python compare.py [page ...]` (default: all 9).
- **measure_video.py** / **measure_all_live.py** — measure the rendered video
  player box (width/height/aspect) local vs live, to keep videos pixel-exact
  (live sizes them to a 16:9 box = width × 0.5625, top-aligned in the cell).
- **capture_finnish.py** — drives the live site's Weglot switcher, captures the
  English→Finnish translation for every text node across all 9 pages, writes
  `finnish_dict.json`. Re-run to refresh translations.
- **build_lang.py** — reads `finnish_dict.json`, generates `../js/lala-lang.js`
  (the self-contained EN/FI switcher) and injects it into all pages. Re-run
  after editing translations.
- **clean_grep.py** — audits all pages for remote asset loads; should report
  none except the Google-map iframe and outbound anchor links.
- **finnish_dict.json** — the captured EN→FI dictionary (source of truth for
  the switcher; `build_lang.py` also applies the `Book`→`Varaa` correction).
