#!/usr/bin/env python3
"""Measure the rendered video box (and its grid cell) on local vs live."""
from playwright.sync_api import sync_playwright
from pathlib import Path

LOCAL = Path(r"c:\Users\edvin\projects\klar-pipeline\websites\la-lasagna")
LIVE = "https://www.lalasagnahelsinki.com"

# (key, local file, live path)
TARGETS = [("index", "index.html", "/")]

JS = r"""
() => {
  function box(el){ if(!el) return null; const r=el.getBoundingClientRect();
    const cs=getComputedStyle(el);
    return {w:Math.round(r.width),h:Math.round(r.height),
            ar:(r.width/r.height).toFixed(3),
            pos:cs.position, objfit:cs.objectFit||'', aspectRatio:cs.aspectRatio||''}; }
  const out=[];
  // local uses <video>; live uses native player container / <video> too
  const vids=[...document.querySelectorAll('video')];
  vids.forEach((v,i)=>{
    const player=v.closest('.native-video-player');
    const fe=v.closest('.fe-block');
    out.push({i, video:box(v), player:box(player), feCell:box(fe)});
  });
  return out;
}
"""

def run(url, width):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": width, "height": 1000})
        pg.goto(url, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)
        data = pg.evaluate(JS)
        b.close()
        return data

for key, lf, lp in TARGETS:
    for width in (1440, 768, 390):
        print(f"\n===== {key} @ {width}px =====")
        loc = run((LOCAL / lf).as_uri(), width)
        liv = run(LIVE + lp, width)
        print("LOCAL:", loc)
        print("LIVE :", liv)
