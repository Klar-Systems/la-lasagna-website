# La Lasagna Helsinki — self-hosted website

A fully self-contained static mirror of [lalasagnahelsinki.com](https://www.lalasagnahelsinki.com),
built to be hostable on any static web host with no Squarespace dependency.

## Contents

- `*.html` — the 9 pages (index, lunch, menu, pizzas, salads, desserts, drinks,
  who-we-are, contact). Internal navigation is rewritten to local `.html` files.
- `css/`, `js/`, `fonts/`, `img/` — all localized assets (every responsive image variant).
- `video/` — the 6 background videos, downloaded from the original HLS streams and
  remuxed to MP4 (stored via **Git LFS**).

## Hosting

Serve the folder as static files from any web server, e.g.:

```sh
python -m http.server 8099
```

Then open `http://127.0.0.1:8099/index.html`.

The only intentionally external resources are: the Google Maps embed in the footer,
outbound links (Instagram, Wolt, suppliers), and the `<link rel="canonical">` SEO tags
pointing at the live domain.

## Contact form

The original Squarespace form submitted to Squarespace's own backend, which does not
exist off-platform. The form here submits via `mailto:lalasagnahelsinki@gmail.com`
(the same address the live site uses for inquiries). Swap in a form backend
(e.g. Formspree) for a silent AJAX submit if desired.

## Build / provenance scripts

- `mirror.py` — fetches pages + assets and rewrites URLs to local.
- `localize_videos.py` — downloads the HLS videos and swaps in native `<video>`.
- `localize_dynamic.py` — reconstructs the JS-rendered map, contact form, scroll-reveal
  state, scaled-text headlines, and shape blocks.
- `mirror-manifest.json` — URL → local-path map and asset counts.
