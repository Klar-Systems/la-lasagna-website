#!/usr/bin/env python3
"""Capture EN->FI translations from the live (Weglot-powered) site for all pages.

Per page: force an English baseline (clear Weglot's localStorage + reload), record
every visible text node BY REFERENCE plus its English value, switch the picker to
Suomi, wait, then read the same node references again (Weglot replaces text in
place, so the same node now holds Finnish). Reference-pairing is exact regardless
of any nodes Weglot adds/removes elsewhere."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

LIVE = "https://www.lalasagnahelsinki.com"
PAGES = ["/", "/lunch", "/menu", "/pizzas", "/salads", "/desserts", "/drinks",
         "/who-we-are", "/contact"]
OUT = Path(__file__).resolve().parent / "finnish_dict.json"

# build window.__wg = [text nodes...]; return their trimmed English values
SNAPSHOT_EN = r"""
() => {
  const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p=n.parentElement;
      while(p){ if(skip.has(p.tagName)) return NodeFilter.FILTER_REJECT; p=p.parentElement; }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[]; let n;
  while(n=w.nextNode()){ nodes.push(n); }
  window.__wg = nodes;
  return nodes.map(n=>n.nodeValue.trim());
}
"""
READ_FI = "() => window.__wg.map(n => (n.nodeValue||'').trim())"
OPEN_PICKER = "() => { const d=document.querySelector('#multilingual-language-picker-desktop'); if(d) d.click(); }"
CLICK_SUOMI = ("() => { const a=[...document.querySelectorAll('.language-item a,[role=option]')]"
               ".find(e=>/suomi/i.test(e.innerText)); if(a){a.click(); return true;} return false; }")


def capture(pg, path):
    pg.goto(LIVE + path, wait_until="networkidle", timeout=60000)
    # force English baseline
    pg.evaluate("() => { try{localStorage.clear();sessionStorage.clear();}catch(e){} }")
    pg.context.clear_cookies()
    pg.goto(LIVE + path, wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(2500)
    en = pg.evaluate(SNAPSHOT_EN)
    pg.evaluate(OPEN_PICKER)
    pg.wait_for_timeout(700)
    if not pg.evaluate(CLICK_SUOMI):
        print(f"  ! {path}: could not click Suomi")
        return {}
    for _ in range(28):
        pg.wait_for_timeout(500)
        fi_now = pg.evaluate(READ_FI)
        if sum(1 for a, b in zip(en, fi_now) if a != b) >= 5:
            break
    pg.wait_for_timeout(2000)
    fi = pg.evaluate(READ_FI)
    pairs = {}
    for a, b in zip(en, fi):
        if a and b and a != b and a not in pairs:
            pairs[a] = b
    changed = sum(1 for a, b in zip(en, fi) if a != b)
    print(f"  + {path}: {len(pairs)} pairs ({changed} nodes changed / {len(en)})")
    return pairs


def main():
    merged = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 1000}, locale="en-US")
        for path in PAGES:
            try:
                for k, v in capture(pg, path).items():
                    merged.setdefault(k, v)
            except Exception as e:
                print(f"  ! {path}: {e}")
        b.close()
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"\nTOTAL merged EN->FI pairs: {len(merged)} -> {OUT}")


if __name__ == "__main__":
    main()
