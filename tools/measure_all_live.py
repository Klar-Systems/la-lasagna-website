#!/usr/bin/env python3
"""Measure every live video player's box + aspect ratio across the 4 video pages."""
from playwright.sync_api import sync_playwright

LIVE = "https://www.lalasagnahelsinki.com"
PAGES = [("index", "/"), ("lunch", "/lunch"), ("pizzas", "/pizzas"),
         ("who-we-are", "/who-we-are")]

JS = r"""
() => [...document.querySelectorAll('video')].map((v,i)=>{
  const player=v.closest('.native-video-player');
  const fe=v.closest('.fe-block');
  const b=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),ar:+(r.width/r.height).toFixed(3)};};
  const cs=player?getComputedStyle(player):null;
  return {i, player:b(player), cell:b(fe), cssAspect:cs?cs.aspectRatio:''};
});
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for key, path in PAGES:
        pg = b.new_page(viewport={"width": 1440, "height": 1000})
        pg.goto(LIVE + path, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(2500)
        print(key, pg.evaluate(JS))
        pg.close()
    b.close()
