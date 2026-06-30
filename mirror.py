#!/usr/bin/env python3
"""
Mirror lalasagnahelsinki.com into a self-hostable static copy.

Downloads HTML + all CSS + all JS + all image variants + fonts, rewrites every
remote URL to a local relative path, and resolves Squarespace's lazy-load so
images render offline. Output lands next to this script.

Idempotent: re-running re-downloads into the same tree.
"""

import os
import re
import sys
import json
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path

from bs4 import BeautifulSoup

SITE = "https://www.lalasagnahelsinki.com/"
ROOT = Path(__file__).resolve().parent
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# Every content page of the site -> local html filename. The homepage is
# index.html; the rest are <slug>.html so offline navigation works.
PAGES = {
    "/": "index.html",
    "/lunch": "lunch.html",
    "/menu": "menu.html",
    "/pizzas": "pizzas.html",
    "/salads": "salads.html",
    "/desserts": "desserts.html",
    "/drinks": "drinks.html",
    "/who-we-are": "who-we-are.html",
    "/contact": "contact.html",
}

DIRS = {k: ROOT / k for k in ("css", "js", "img", "fonts")}
for d in DIRS.values():
    d.mkdir(parents=True, exist_ok=True)

# url (absolute) -> local relative path (as referenced from index.html / from css)
URL2LOCAL = {}          # absolute url -> Path (absolute on disk)
_cache = {}             # absolute url -> bytes (avoid re-download)
_failures = []


def log(*a):
    print(*a, flush=True)


def absolutize(url, base=SITE):
    url = (url or "").strip()
    if not url or url.startswith(("data:", "blob:", "javascript:", "mailto:", "tel:", "#")):
        return None
    if url.startswith("//"):
        url = "https:" + url
    return urllib.parse.urljoin(base, url)


def fetch(url):
    if url in _cache:
        return _cache[url]
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
    except Exception as e:  # noqa
        _failures.append((url, str(e)))
        log("  ! FAIL", url, "->", e)
        return None
    _cache[url] = data
    return data


def safe_name(url, kind):
    """Build a deterministic local filename. Encodes ?format=Nw width and
    disambiguates collisions with a short hash of the full URL."""
    parsed = urllib.parse.urlparse(url)
    base = os.path.basename(parsed.path) or "index"
    base = urllib.parse.unquote(base)
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    stem, ext = os.path.splitext(base)

    qs = urllib.parse.parse_qs(parsed.query)
    fmt = qs.get("format", [None])[0]
    width = None
    if fmt and fmt.endswith("w") and fmt[:-1].isdigit():
        width = fmt  # e.g. 1500w

    # ensure an extension for known kinds
    if not ext:
        ext = {"css": ".css", "js": ".js", "fonts": ".woff2"}.get(kind, "")

    h = hashlib.sha1(url.encode()).hexdigest()[:8]
    parts = [stem or "asset"]
    if width:
        parts.append(width)
    parts.append(h)
    return "".join(["-".join(parts), ext])


def localize(url, kind, base=SITE):
    """Download `url` into DIRS[kind] (once) and return its on-disk Path.
    Returns None on failure or non-localizable url."""
    absu = absolutize(url, base)
    if absu is None:
        return None
    if absu in URL2LOCAL:
        return URL2LOCAL[absu]
    data = fetch(absu)
    if data is None:
        return None
    dest = DIRS[kind] / safe_name(absu, kind)
    # avoid clobbering two different urls onto one name (hash makes this rare)
    dest.write_bytes(data)
    URL2LOCAL[absu] = dest
    return dest


def rel_from_root(dest: Path) -> str:
    return dest.relative_to(ROOT).as_posix()


def rel_from_css(dest: Path) -> str:
    # css files live in ROOT/css, assets they point to live in ROOT/<kind>
    return os.path.relpath(dest, DIRS["css"]).replace(os.sep, "/")


CSS_URL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+?)['\"]?\s*\)")
CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?\s*['\"]([^'\"]+)['\"]")


def process_css_text(text, css_base):
    """Rewrite url(...) and @import inside CSS to local paths (relative to /css)."""
    def repl_url(m):
        u = m.group(1)
        if u.startswith("data:"):
            return m.group(0)
        # decide kind by extension
        low = u.split("?")[0].lower()
        kind = "fonts" if low.endswith((".woff2", ".woff", ".ttf", ".otf", ".eot")) else "img"
        dest = localize(u, kind, base=css_base)
        if not dest:
            return m.group(0)
        return f"url({rel_from_css(dest)})"

    def repl_import(m):
        u = m.group(1)
        dest = localize(u, "css", base=css_base)
        if not dest:
            return m.group(0)
        # recursively process the imported css
        sub = dest.read_text(encoding="utf-8", errors="ignore")
        dest.write_text(process_css_text(sub, dest_url_of(dest)), encoding="utf-8")
        return f'@import "{rel_from_css(dest)}"'

    text = CSS_IMPORT_RE.sub(repl_import, text)
    text = CSS_URL_RE.sub(repl_url, text)
    return text


_dest_url = {}  # Path -> original absolute url (so nested css resolves relative urls)


def dest_url_of(dest):
    return _dest_url.get(dest, SITE)


def localize_css(url, base=SITE):
    absu = absolutize(url, base)
    if absu is None:
        return None
    if absu in URL2LOCAL:
        return URL2LOCAL[absu]
    data = fetch(absu)
    if data is None:
        return None
    dest = DIRS["css"] / safe_name(absu, "css")
    URL2LOCAL[absu] = dest
    _dest_url[dest] = absu
    text = data.decode("utf-8", errors="ignore")
    dest.write_text(process_css_text(text, absu), encoding="utf-8")
    return dest


def srcset_localize(value, base=SITE):
    """Rewrite a srcset attribute, downloading every variant."""
    out = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split()
        u = bits[0]
        desc = " ".join(bits[1:])
        dest = localize(u, "img", base=base)
        if dest:
            out.append((rel_from_root(dest) + (" " + desc if desc else "")).strip())
        else:
            out.append(part)
    return ", ".join(out)


def rewrite_internal_links(soup):
    """Point in-site <a href="/slug"> at the local .html file so navigation
    works offline. Known pages map via PAGES; unknown internal paths (e.g.
    /cart) are left untouched."""
    for a in soup.find_all("a"):
        href = a.get("href")
        if not href or not href.startswith("/") or href.startswith("//"):
            continue
        base, _, frag = href.partition("#")
        target = PAGES.get(base or "/")
        if target:
            a["href"] = target + (("#" + frag) if frag else "")


def process_page(path):
    url = urllib.parse.urljoin(SITE, path)
    outfile = PAGES[path]
    log(f"\n--- page {path}  ->  {outfile}")
    html = fetch(url)
    if html is None:
        log("  ! could not fetch", url)
        return False
    soup = BeautifulSoup(html, "lxml")

    # --- stylesheets & icons & preloads (link[href]) ---
    for link in list(soup.find_all("link")):
        href = link.get("href")
        if not href:
            continue
        rels = " ".join(link.get("rel", [])).lower()
        # preconnect/dns-prefetch are remote-origin hints; useless offline -> drop
        if any(k in rels for k in ("preconnect", "dns-prefetch")):
            link.decompose()
            continue
        if "stylesheet" in rels:
            dest = localize_css(href)
            if dest:
                link["href"] = rel_from_root(dest)
        elif any(k in rels for k in ("icon", "preload", "apple-touch", "mask-icon", "image_src")):
            as_ = (link.get("as") or "").lower()
            low = href.split("?")[0].lower()
            if as_ == "style" or low.endswith(".css"):
                kind = "css"
            elif as_ == "script" or low.endswith(".js"):
                kind = "js"
            elif as_ == "font" or low.endswith((".woff2", ".woff", ".ttf", ".otf")):
                kind = "fonts"
            else:
                kind = "img"
            dest = localize_css(href) if kind == "css" else localize(href, kind)
            if dest:
                link["href"] = rel_from_root(dest)

    # --- scripts ---
    for s in soup.find_all("script"):
        src = s.get("src")
        if not src:
            continue
        dest = localize(src, "js")
        if dest:
            s["src"] = rel_from_root(dest)

    # --- images ---
    for img in soup.find_all("img"):
        # gather every candidate url, download all
        data_src = img.get("data-src")
        src = img.get("src")
        srcset = img.get("srcset") or img.get("data-srcset")

        local_main = None
        # prefer the real (data-src) over the lightweight placeholder
        for cand in (data_src, src):
            d = localize(cand, "img") if cand else None
            if d:
                local_main = d
                break

        if srcset:
            new_ss = srcset_localize(srcset)
            img["srcset"] = new_ss
            if img.has_attr("data-srcset"):
                img["data-srcset"] = new_ss

        if local_main:
            img["src"] = rel_from_root(local_main)
        # neutralize Squarespace lazy loader so it won't re-request ?format urls
        for attr in ("data-src", "data-image", "data-load"):
            if img.has_attr(attr):
                del img[attr]
        cls = img.get("class")
        if cls:
            img["class"] = [c for c in cls if c not in ("loading", "summary-thumbnail-image")] or None
        img["loading"] = "eager"
        if img.has_attr("data-image-dimensions"):
            pass  # keep dims; harmless

    # --- <source srcset> (picture) ---
    for sc in soup.find_all("source"):
        ss = sc.get("srcset")
        if ss:
            sc["srcset"] = srcset_localize(ss)

    # --- inline style="" attributes with url() ---
    for el in soup.find_all(style=True):
        st = el["style"]
        if "url(" in st:
            def repl(m):
                u = m.group(1)
                if u.startswith("data:"):
                    return m.group(0)
                d = localize(u, "img")
                return f"url({rel_from_root(d)})" if d else m.group(0)
            el["style"] = CSS_URL_RE.sub(repl, st)

    # --- inline <style> blocks ---
    for st in soup.find_all("style"):
        if st.string and "url(" in st.string:
            # these live in the HTML at root level -> paths relative to root
            def repl(m):
                u = m.group(1)
                if u.startswith("data:"):
                    return m.group(0)
                low = u.split("?")[0].lower()
                kind = "fonts" if low.endswith((".woff2", ".woff", ".ttf", ".otf")) else "img"
                d = localize(u, kind)
                return f"url({rel_from_root(d)})" if d else m.group(0)
            st.string.replace_with(CSS_URL_RE.sub(repl, st.string))

    # --- images referenced only inside the SQUARESPACE_CONTEXT JSON / other inline JS ---
    # download them so any JS that reads them finds a local file; also rewrite the
    # literal CDN urls in inline scripts to local relative paths.
    cdn_re = re.compile(r"https://images\.squarespace-cdn\.com/[^\s\"'\\)]+")
    for sc in soup.find_all("script"):
        if sc.get("src") or not sc.string:
            continue
        txt = sc.string
        urls = set(cdn_re.findall(txt))
        if not urls:
            continue
        for u in urls:
            u_clean = u.rstrip("\\")
            d = localize(u_clean, "img")
            if d:
                txt = txt.replace(u, rel_from_root(d))
        sc.string.replace_with(txt)

    # rewrite in-site navigation to local html files, then write
    rewrite_internal_links(soup)
    (ROOT / outfile).write_text(str(soup), encoding="utf-8")
    return True


def main():
    ok, failed = [], []
    for path in PAGES:
        (ok if process_page(path) else failed).append(path)

    # ---- report ----
    counts = {k: len(list(v.glob("*"))) for k, v in DIRS.items()}
    log("\n==== DONE ====")
    log("pages mirrored:", len(ok), "/", len(PAGES), "->", [PAGES[p] for p in ok])
    if failed:
        log("pages FAILED:", failed)
    log("assets downloaded:", counts)
    log("total unique urls localized:", len(URL2LOCAL))
    log("asset failures:", len(_failures))
    for u, e in _failures[:40]:
        log("  FAIL", u, "->", e)
    # save a manifest
    (ROOT / "mirror-manifest.json").write_text(json.dumps(
        {"pages_ok": ok, "pages_failed": failed,
         "url2local": {u: rel_from_root(p) for u, p in URL2LOCAL.items()},
         "failures": _failures, "counts": counts}, indent=2), encoding="utf-8")

    # localize background videos (HLS -> local mp4 + native <video>) so the
    # mirror needs no Squarespace CDN. Runs after pages are written.
    try:
        import localize_videos
        log("\n--- localizing background videos ---")
        localize_videos.localize()
    except Exception as e:  # noqa
        log("video localization step FAILED:", e)

    # rebuild JS-rendered blocks (footer Google map on every page, contact form)
    try:
        import localize_dynamic
        log("\n--- rebuilding map + form blocks ---")
        localize_dynamic.main()
    except Exception as e:  # noqa
        log("dynamic block step FAILED:", e)


if __name__ == "__main__":
    main()
