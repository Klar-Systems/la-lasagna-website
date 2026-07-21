#!/usr/bin/env python3
"""De-Squarespace the static mirror.

Removes every runtime connection to Squarespace servers so the site is a
fully self-contained static site served from Vercel:

  * All Squarespace-authored <script> tags (keeps only js/lala-lang.js).
  * The SQUARESPACE_ROLLUPS / SQUARESPACE_CONTEXT / COOKIE_BANNER inline
    bootstrap scripts (these registered the assets.squarespace.com loader).
  * Repoints the two remaining static image references (itemprop image and
    the ld+json logo) from squarespace CDNs to the local copies.
  * Injects the Vercel Web Analytics snippet before </body>.

Reveal/animation classes that the removed JS used to toggle, and the masonry
gallery layout, are handled by css/lala-polish.css and js/lala-lang.js.

Idempotent: safe to re-run.
"""
import re
import sys

PAGES = ["index", "menu", "lunch", "pizzas", "salads", "desserts", "drinks",
         "who-we-are", "contact"]

# Our custom local scripts (all named js/lala-*.js). Everything else under js/
# is Squarespace runtime and gets removed.
KEEP_SCRIPT_PREFIX = "js/lala-"

LOCAL_IMAGE = "https://www.lalasagnahelsinki.com/img/apple-touch-icon-1500w-52089014.png"

VERCEL_ANALYTICS = (
    '<script>window.va=window.va||function(){(window.vaq=window.vaq||[])'
    '.push(arguments);};</script>\n'
    '<script defer src="/_vercel/insights/script.js"></script>\n'
)

SCRIPT_RE = re.compile(r'<script\b[^>]*>.*?</script>', re.S | re.I)


def is_squarespace_script(tag: str) -> bool:
    """True if this <script> tag is Squarespace runtime and must be removed."""
    m = re.search(r'src="([^"]+)"', tag)
    if m:
        src = m.group(1)
        # Keep our custom lala-* scripts; drop every other js/ bundle.
        if src.startswith(KEEP_SCRIPT_PREFIX):
            return False
        return src.startswith("js/") or "squarespace" in src or "sqspcdn" in src
    # Inline scripts: drop the Squarespace bootstrap ones, keep the rest
    # (ld+json schema, TextAttributes data, lala-scaledtext).
    body = tag
    if 'id="lala-scaledtext-js"' in body:
        return False
    if 'type="application/ld+json"' in body:
        return False
    if 'class="TextAttributes-props"' in body or 'TextAttributes-props' in body:
        return False
    markers = ("SQUARESPACE_ROLLUPS", "SQUARESPACE_CONTEXT", "Static.SQUARESPACE",
               "rollups[name]", "assets.squarespace.com",
               "COOKIE_BANNER_CAPABLE", 'data-name="static-context"')
    return any(mk in body for mk in markers)


def transform(html: str) -> tuple[str, dict]:
    stats = {"scripts_removed": 0, "img_repointed": 0, "analytics_added": 0,
             "blocks_blanked": 0, "comments_removed": 0}

    def repl(m):
        tag = m.group(0)
        if is_squarespace_script(tag):
            stats["scripts_removed"] += 1
            return ""
        return tag

    html = SCRIPT_RE.sub(repl, html)

    # Strip HTML comments that mention Squarespace (e.g. "This is Squarespace.",
    # "End of Squarespace Headers", the caterpillar-*.squarespace.com note).
    html, stats["comments_removed"] = re.subn(
        r'<!--[^>]*?[Ss]quarespace[^>]*?-->', '', html)

    # Blank the inert component-definition attributes. Their consumer JS
    # (website.components.*.visitor.js) is removed, so these single-quoted
    # JSON arrays of definitions.sqspcdn.com URLs no longer load anything;
    # empty them so zero Squarespace references remain.
    html, n1 = re.subn(r"data-block-css='[^']*'", "data-block-css='[]'", html)
    html, n2 = re.subn(r"data-block-scripts='[^']*'", "data-block-scripts='[]'", html)
    stats["blocks_blanked"] = n1 + n2

    # Repoint itemprop image (static1.squarespace.com apple-touch-icon).
    new_html, n = re.subn(
        r'(<meta content=")http[^"]*static1\.squarespace\.com[^"]*(" itemprop="image"/>)',
        r'\g<1>' + LOCAL_IMAGE + r'\g<2>', html)
    stats["img_repointed"] += n
    html = new_html

    # Repoint ld+json logo image (images.squarespace-cdn.com).
    new_html, n = re.subn(
        r'"image":"//images\.squarespace-cdn\.com/[^"]*"',
        '"image":"' + LOCAL_IMAGE + '"', html)
    stats["img_repointed"] += n
    html = new_html

    # Inject Vercel Analytics once, just before </body>.
    if "/_vercel/insights/script.js" not in html:
        html = html.replace("</body>", VERCEL_ANALYTICS + "</body>", 1)
        stats["analytics_added"] = 1

    # Tidy: collapse runs of blank lines left by removed scripts.
    html = re.sub(r'\n[ \t]*\n[ \t]*\n+', '\n\n', html)
    return html, stats


def main():
    dry = "--apply" not in sys.argv
    for name in PAGES:
        path = f"{name}.html"
        with open(path, encoding="utf-8") as f:
            src = f.read()
        out, stats = transform(src)
        print(f"{name:12} removed={stats['scripts_removed']:3} "
              f"blanked={stats['blocks_blanked']:3} "
              f"img_repointed={stats['img_repointed']} "
              f"analytics={stats['analytics_added']}")
        if not dry:
            with open(path, "w", encoding="utf-8") as f:
                f.write(out)
    print("APPLIED" if not dry else "DRY RUN (pass --apply to write)")


if __name__ == "__main__":
    main()
