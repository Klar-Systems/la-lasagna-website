#!/usr/bin/env python3
"""
Localize the Squarespace background videos so the mirror needs no Squarespace CDN.

For every element carrying `data-config-video`, download the HLS stream (highest-res
variant) and remux to video/<id>.mp4 with ffmpeg, then replace the Squarespace video
component with a native autoplay/muted/loop <video> pointing at the local file.

Run from websites/la-lasagna/.  Idempotent: skips MP4s already downloaded.
"""
import glob
import html
import json
import re
import subprocess
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
VID = ROOT / "video"
VID.mkdir(exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")

STREAM_RE = re.compile(
    r'#EXT-X-STREAM-INF:[^\n]*?RESOLUTION=(\d+)x(\d+)[^\n]*\n(\S+)')


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=300).read()


def best_variant(master_url):
    """Return the variant-playlist URL with the largest pixel area."""
    text = fetch_text(master_url)
    best, best_area = None, -1
    for w, h, url in STREAM_RE.findall(text):
        area = int(w) * int(h)
        if area > best_area:
            best, best_area = url.strip(), area
    return best


def download_video(vid, alexandria_url):
    """Squarespace serves AES-128 HLS with byte-range, extensionless segment URLs
    that contain a ':' — ffmpeg can't fetch those directly. So we pull the
    playlist, key and media file locally, rewrite the playlist to local paths,
    and let ffmpeg decrypt + remux from disk."""
    out = VID / f"{vid}.mp4"
    if out.exists() and out.stat().st_size > 10_000:
        print(f"  = {vid}.mp4 already present ({out.stat().st_size} bytes)")
        return out
    master = alexandria_url.replace("{variant}", "playlist.m3u8")
    variant = best_variant(master)
    if not variant:
        print(f"  ! {vid}: no variant found"); return None

    pl = fetch_text(variant)
    tmp = VID / f"_tmp_{vid}"
    tmp.mkdir(exist_ok=True)
    seg_map, key_map = {}, {}
    lines = []
    for line in pl.splitlines():
        if line.startswith("#EXT-X-KEY"):
            m = re.search(r'URI="([^"]+)"', line)
            if m and m.group(1) not in key_map:
                kf = f"key{len(key_map)}.bin"
                (tmp / kf).write_bytes(fetch_bytes(m.group(1)))
                key_map[m.group(1)] = kf
            if m:
                line = line.replace(m.group(1), key_map[m.group(1)])
        elif line.startswith("http"):
            if line not in seg_map:
                sf = f"seg{len(seg_map)}.ts"
                print(f"    downloading media {sf} for {vid} ...")
                (tmp / sf).write_bytes(fetch_bytes(line))
                seg_map[line] = sf
            line = seg_map[line]
        lines.append(line)
    (tmp / "local.m3u8").write_text("\n".join(lines), encoding="utf-8")

    print(f"  + {vid}: decrypt+remux -> {out.name}")
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-allowed_extensions", "ALL",
           "-protocol_whitelist", "file,crypto,data",
           "-i", str(tmp / "local.m3u8"), "-c", "copy",
           "-movflags", "+faststart", str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    # clean temp media regardless
    for p in tmp.glob("*"):
        p.unlink()
    tmp.rmdir()
    if r.returncode != 0 or not out.exists():
        print(f"  ! ffmpeg failed for {vid}:\n{r.stderr[:800]}")
        return None
    make_poster(vid, out)
    return out


def make_poster(vid, mp4):
    """Squarespace shows a poster frame under its video; reproduce one so the
    block isn't black before autoplay (and matches the live render)."""
    poster = ROOT / "img" / f"poster-{vid}.jpg"
    dur = 10.0
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", str(mp4)],
                       capture_output=True, text=True).stdout.strip()
    try:
        dur = float(o)
    except ValueError:
        pass
    off = min(2.0, dur * 0.1)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(off),
                    "-i", str(mp4), "-frames:v", "1", "-q:v", "3", str(poster)],
                   check=False)
    return poster


def localize():
    # 1) collect unique videos
    videos = {}
    for f in sorted(glob.glob(str(ROOT / "*.html"))):
        soup = BeautifulSoup(open(f, encoding="utf-8").read(), "lxml")
        for el in soup.find_all(attrs={"data-config-video": True}):
            try:
                cfg = json.loads(html.unescape(el["data-config-video"]))
            except Exception:
                continue
            vid = cfg.get("id") or cfg.get("systemDataId")
            videos.setdefault(vid, cfg.get("alexandriaUrl"))

    print(f"Unique videos: {len(videos)}")
    have = {}
    for vid, url in videos.items():
        p = download_video(vid, url)
        if p:
            have[vid] = p

    # 2) swap markup on each page
    for f in sorted(glob.glob(str(ROOT / "*.html"))):
        soup = BeautifulSoup(open(f, encoding="utf-8").read(), "lxml")
        changed = 0
        for el in soup.find_all(attrs={"data-config-video": True}):
            try:
                cfg = json.loads(html.unescape(el["data-config-video"]))
            except Exception:
                continue
            vid = cfg.get("id") or cfg.get("systemDataId")
            if vid not in have:
                continue
            # poster: prefer the frame we extracted from the mp4, else any image
            # already inside the block
            poster = None
            if (ROOT / "img" / f"poster-{vid}.jpg").exists():
                poster = f"img/poster-{vid}.jpg"
            else:
                img = el.find("img")
                if img and img.get("src"):
                    poster = img["src"]

            video = soup.new_tag("video")
            video["src"] = f"video/{vid}.mp4"
            video["autoplay"] = ""
            video["muted"] = ""
            video["loop"] = ""
            video["playsinline"] = ""
            video["preload"] = "auto"
            if poster:
                video["poster"] = poster
            video["style"] = ("position:absolute;inset:0;width:100%;height:100%;"
                              "object-fit:contain;object-position:center;display:block;")
            # replace the inner player markup, keep the outer wrapper element/classes
            el.clear()
            del el["data-config-video"]
            if el.has_attr("data-config-settings"):
                del el["data-config-settings"]
            el.append(video)

            # The block lives in a Squarespace fluid-engine grid cell. Live,
            # Squarespace sizes the native player to a fixed 16:9 box (width =
            # cell width, height = width*0.5625) top-aligned in the cell — NOT
            # filling the cell's full height. Reproduce that exact box so the
            # render matches the live site pixel-for-pixel.
            el["style"] = "position:relative;width:100%;aspect-ratio:1.77777778;"
            fe = el.find_parent(class_=re.compile(r"\bfe-block\b"))
            if fe:
                fe["style"] = ((fe.get("style") or "").rstrip("; ")
                               + ";position:relative;").lstrip(";")
            changed += 1
        if changed:
            Path(f).write_text(str(soup), encoding="utf-8")
            print(f"  swapped {changed} video(s) in {Path(f).name}")


if __name__ == "__main__":
    localize()
