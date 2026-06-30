#!/usr/bin/env python3
"""Render local mirror vs live site for each page and stitch side-by-side."""
import subprocess, sys, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LOCAL = Path(r"c:\Users\edvin\projects\klar-pipeline\websites\la-lasagna")
OUT = Path(__file__).resolve().parent / "compare"
OUT.mkdir(exist_ok=True)
LIVE = "https://www.lalasagnahelsinki.com"

PAGES = {
    "index": ("index.html", "/"),
    "lunch": ("lunch.html", "/lunch"),
    "menu": ("menu.html", "/menu"),
    "pizzas": ("pizzas.html", "/pizzas"),
    "salads": ("salads.html", "/salads"),
    "desserts": ("desserts.html", "/desserts"),
    "drinks": ("drinks.html", "/drinks"),
    "who-we-are": ("who-we-are.html", "/who-we-are"),
    "contact": ("contact.html", "/contact"),
}
W = 1440
H = 16000
SLICE = 1300  # readable side-by-side slice height


def shoot(url, dest):
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--no-sandbox", "--force-device-scale-factor=1",
           f"--window-size={W},{H}", "--virtual-time-budget=20000",
           "--run-all-compositor-stages-before-draw",
           f"--screenshot={dest}", url]
    subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    return Path(dest).exists()


def content_height(path):
    """Find the last row that differs from the uniform trailing background band."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    last = a[-1]
    rowdiff = np.abs(a - last).mean(axis=(1, 2))  # mean diff of each row vs bottom row
    nz = np.where(rowdiff > 3.0)[0]
    return int(nz.max()) + 30 if len(nz) else a.shape[0]


def slice_pairs(key, lp, rp, fname, path):
    li = Image.open(lp).convert("RGB")
    ri = Image.open(rp).convert("RGB")
    h = min(content_height(lp), content_height(rp), li.height, ri.height)
    gap = 20
    try:
        f = ImageFont.truetype("arialbd.ttf", 24)
    except Exception:
        f = ImageFont.load_default()
    n = (h + SLICE - 1) // SLICE
    made = []
    for i in range(n):
        y0 = i * SLICE
        y1 = min(y0 + SLICE, h)
        ls = li.crop((0, y0, W, y1))
        rs = ri.crop((0, y0, W, y1))
        bar = 34
        comp = Image.new("RGB", (W * 2 + gap, (y1 - y0) + bar), (35, 35, 35))
        comp.paste(ls, (0, bar))
        comp.paste(rs, (W + gap, bar))
        d = ImageDraw.Draw(comp)
        d.text((12, 6), f"LOCAL {fname}  [px {y0}-{y1}]", fill=(120, 230, 120), font=f)
        d.text((W + gap + 12, 6), f"LIVE {path}  [px {y0}-{y1}]", fill=(230, 200, 120), font=f)
        cp = OUT / f"cmp_{key}_{i:02d}.png"
        comp.save(cp)
        made.append(cp.name)
    print(f"{key}: content_h={h}, {len(made)} slices -> {made[0]}..{made[-1]}")
    return made


def main():
    only = sys.argv[1:] or list(PAGES)
    for key in only:
        fname, path = PAGES[key]
        lp = OUT / f"{key}_local.png"
        rp = OUT / f"{key}_live.png"
        shoot((LOCAL / fname).as_uri(), str(lp))
        shoot(LIVE + path, str(rp))
        slice_pairs(key, lp, rp, fname, path)


if __name__ == "__main__":
    main()
