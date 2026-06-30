#!/usr/bin/env python3
"""SEO pass for the La Lasagna mirror, preparing for the Squarespace->Vercel move.

Preserves the existing (good) URL slugs and canonicals; fixes the inherited
Squarespace SEO defects and adds Restaurant structured data for search + AI SEO.

What it does:
  1. Unique <title> + meta description on the 5 menu sub-pages that all shipped
     as "Lasagnas — La Lasagna" with one identical description; fills lunch's
     empty description.
  2. Replaces the empty Squarespace LocalBusiness JSON-LD (no address/phone/hours,
     dead CDN image) with a full Restaurant schema (NAP, geo, hours, menu, cuisine,
     price, reservations, Instagram) on every page.
  3. Re-points og:image / twitter:image / thumbnailUrl off the soon-dead
     static1.squarespace.com URL onto the self-hosted icon.
  4. Writes sitemap.xml + robots.txt at the site root.
Idempotent: safe to re-run.
"""
import json, glob
from pathlib import Path
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parent.parent
DOMAIN = "https://www.lalasagnahelsinki.com"
ICON = f"{DOMAIN}/img/apple-touch-icon-1500w-52089014.png"
LOGO = f"{DOMAIN}/img/Lalasagna_Helsinki_lgo-1500w-cc21ba81.png"

# --- per-page title/description fixes (only where the inherited SEO was broken) ---
PAGES = {
    "menu.html": (
        "Menu | Six Sicilian Lasagnas Baked Fresh Daily — La Lasagna",
        "La Lasagna's menu in Helsinki: six varieties of authentic Sicilian lasagna "
        "baked fresh every day, plus pizzas, salads, desserts and drinks. Dine in or takeaway."),
    "pizzas.html": (
        "Pizzas | Freshly Baked Sicilian Pizzas in Helsinki — La Lasagna",
        "Freshly baked Sicilian-style pizzas at La Lasagna in Helsinki's Punavuori. "
        "Authentic Italian flavours, dine in or takeaway."),
    "salads.html": (
        "Salads | Fresh Self-Made Italian Salads in Helsinki — La Lasagna",
        "A selection of uniquely self-made Italian salads at La Lasagna in Helsinki. "
        "Fresh ingredients and authentic flavours, dine in or takeaway."),
    "desserts.html": (
        "Desserts | Home-Made Sicilian Dolci in Helsinki — La Lasagna",
        "Home-made, tasty Sicilian desserts at La Lasagna in Helsinki's Punavuori — "
        "the sweet finish to an authentic Italian meal."),
    "drinks.html": (
        "Drinks | Wine, Spritz & Italian Drinks in Helsinki — La Lasagna",
        "Wine, spritz, beer and soft drinks to pair with authentic Sicilian food at "
        "La Lasagna in Helsinki's Punavuori."),
    "lunch.html": (
        "Lunch | Sicilian Lasagna Lunch Deal in Helsinki — La Lasagna",
        "Lunch at La Lasagna, Helsinki: six varieties of traditional Sicilian lasagna "
        "baked daily, from €14,90. Lunch served Mon–Fri 10:30–14:30 in Punavuori."),
}

RESTAURANT = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "La Lasagna",
    "url": DOMAIN,
    "image": LOGO,
    "logo": LOGO,
    "telephone": "+358 40 365 1664",
    "email": "lalasagnahelsinki@gmail.com",
    "servesCuisine": ["Italian", "Sicilian"],
    "priceRange": "€€",
    "currenciesAccepted": "EUR",
    "acceptsReservations": True,
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "Iso Roobertinkatu 11",
        "postalCode": "00120",
        "addressLocality": "Helsinki",
        "addressRegion": "Uusimaa",
        "addressCountry": "FI",
    },
    "geo": {"@type": "GeoCoordinates", "latitude": 60.1634999, "longitude": 24.9425606},
    "hasMap": "https://maps.google.com/maps?q=60.1634999,24.9425606",
    "areaServed": "Helsinki",
    "menu": f"{DOMAIN}/menu",
    "openingHoursSpecification": [
        {"@type": "OpeningHoursSpecification",
         "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
         "opens": "10:30", "closes": "21:00"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": "Friday",
         "opens": "10:30", "closes": "23:30"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday",
         "opens": "12:00", "closes": "23:30"},
    ],
    "sameAs": ["https://www.instagram.com/la_lasagna_helsinki/"],
}

def set_title(soup, title):
    if soup.title:
        soup.title.string = title
    for attrs in ({"property": "og:title"}, {"itemprop": "name"}, {"name": "twitter:title"}):
        for t in soup.find_all("meta", attrs=attrs):
            t["content"] = title

def set_desc(soup, desc):
    for attrs in ({"name": "description"}, {"property": "og:description"},
                  {"itemprop": "description"}, {"name": "twitter:description"}):
        for t in soup.find_all("meta", attrs=attrs):
            t["content"] = desc

def fix_images(soup):
    for attrs in ({"property": "og:image"}, {"name": "twitter:image"}, {"itemprop": "thumbnailUrl"}):
        for t in soup.find_all("meta", attrs=attrs):
            if "squarespace" in (t.get("content") or ""):
                t["content"] = ICON

def fix_jsonld(soup):
    rj = json.dumps(RESTAURANT, ensure_ascii=False, separators=(",", ":"))
    for sc in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = sc.string or ""
        if '"LocalBusiness"' in raw:          # replace the empty Squarespace stub
            sc.string = rj
            return
    # no LocalBusiness stub found -> append a fresh Restaurant block
    new = soup.new_tag("script", type="application/ld+json")
    new.string = rj
    (soup.head or soup).append(new)

for f in sorted(glob.glob(str(SITE / "*.html"))):
    name = Path(f).name
    soup = BeautifulSoup(open(f, encoding="utf-8").read(), "lxml")
    if name in PAGES:
        set_title(soup, PAGES[name][0])
        set_desc(soup, PAGES[name][1])
    fix_images(soup)
    fix_jsonld(soup)
    Path(f).write_text(str(soup), encoding="utf-8")
    print(f"  seo: {name}")

# --- sitemap.xml (clean URLs matching canonicals) ---
slugs = ["", "lunch", "menu", "pizzas", "salads", "desserts", "drinks", "who-we-are", "contact"]
urls = "".join(f"<url><loc>{DOMAIN}/{s}</loc></url>" for s in slugs).replace(f"{DOMAIN}/</loc>", f"{DOMAIN}/</loc>")
sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(f"  <url><loc>{DOMAIN}/{s}</loc><changefreq>monthly</changefreq></url>" for s in slugs)
           + "\n</urlset>\n")
(SITE / "sitemap.xml").write_text(sitemap, encoding="utf-8")
print("  wrote sitemap.xml")

(SITE / "robots.txt").write_text(
    f"User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n", encoding="utf-8")
print("  wrote robots.txt")
