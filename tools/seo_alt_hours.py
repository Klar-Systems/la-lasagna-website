#!/usr/bin/env python3
"""Add descriptive alt text to identifiable images and add Sunday=closed to the
Restaurant JSON-LD opening hours, across all La Lasagna pages. Surgical: only
touches the alt attribute of mapped images and the openingHoursSpecification array."""
import re, glob, sys

# basename (src filename minus -<width>w and -<hash>.<ext>) -> descriptive alt
ALT = {
    # Lasagnas (the core menu — main AEO target)
    "Rosa_Marias_lasagna_bolognese": "Rosa Maria's lasagna bolognese – classic beef bolognese lasagna baked fresh at La Lasagna Helsinki",
    "Lasagna_ai_funghi": "Lasagna ai funghi – baked mushroom lasagna at La Lasagna Helsinki",
    "Lasagna_ai_pepperoni": "Lasagna ai peperoni – baked pepperoni lasagna at La Lasagna Helsinki",
    "Lasagna_alle_verdure": "Lasagna alle verdure – baked vegetable lasagna at La Lasagna Helsinki",
    "Lasagna_al_pesto_con_patate": "Lasagna al pesto con patate – pesto and potato lasagna at La Lasagna Helsinki",
    "Lasagna_agli_spinaci_e_formaggio": "Lasagna agli spinaci e formaggio – baked spinach and cheese lasagna at La Lasagna Helsinki",
    "Lasagna_con_salsiccia": "Lasagna con salsiccia – baked Italian sausage lasagna at La Lasagna Helsinki",
    "Lasagna_di_pollo": "Lasagna di pollo – baked chicken lasagna at La Lasagna Helsinki",
    # Cannelloni
    "Cannelloni_di_carne": "Cannelloni di carne – baked meat cannelloni at La Lasagna Helsinki",
    "Cannelloni_ricotta_e_spinaci": "Cannelloni ricotta e spinaci – ricotta and spinach cannelloni at La Lasagna Helsinki",
    # Drinks
    "Cocktails_Helsinki": "Cocktails and Italian drinks at La Lasagna Helsinki",
    "drinks_1": "Drinks served at La Lasagna Helsinki",
    "drinks_2": "Wine and drinks at La Lasagna Helsinki",
    # Story / brand
    "Sicily_Helsinki": "Sicily – the Italian island whose traditional recipes inspire La Lasagna in Helsinki",
    "Lalasagna_Helsinki_lgo": "La Lasagna Helsinki logo",
    "la_lasagna": "La Lasagna Helsinki",
}

IMG_RE = re.compile(r'<img\b[^>]*>', re.IGNORECASE)
SRC_RE = re.compile(r'\bsrc="img/([^"]+)"', re.IGNORECASE)
ALT_RE = re.compile(r'\balt="[^"]*"', re.IGNORECASE)


def basename(fn):
    fn = re.sub(r'-\d+w(?=-)', '', fn)            # drop -###w width variant
    fn = re.sub(r'-[0-9a-f]{6,12}\.[a-z0-9]+$', '', fn, flags=re.I)  # drop -<hash>.<ext>
    fn = re.sub(r'\.[a-z0-9]+$', '', fn, flags=re.I)  # drop bare .ext if no hash
    return fn


def fix_alts(html):
    n = 0
    def repl(m):
        nonlocal n
        tag = m.group(0)
        s = SRC_RE.search(tag)
        if not s:
            return tag
        b = basename(s.group(1))
        if b not in ALT:
            return tag
        new_alt = 'alt="%s"' % ALT[b]
        if ALT_RE.search(tag):
            tag2 = ALT_RE.sub(new_alt, tag, count=1)
        else:
            tag2 = re.sub(r'<img\b', '<img ' + new_alt, tag, count=1, flags=re.I)
        if tag2 != tag:
            n += 1
        return tag2
    return IMG_RE.sub(repl, html), n


SUNDAY = ',{"@type":"OpeningHoursSpecification","dayOfWeek":"Sunday","opens":"00:00","closes":"00:00"}'
# anchor: the Saturday entry that ends the openingHoursSpecification array
SAT_RE = re.compile(r'(\{"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"12:00","closes":"23:30"\})(\])')


def fix_hours(html):
    if '"dayOfWeek":"Sunday"' in html:
        return html, 0
    new, c = SAT_RE.subn(lambda m: m.group(1) + SUNDAY + m.group(2), html)
    return new, c


total_alt = total_hours = 0
for path in sorted(glob.glob("*.html")):
    with open(path, encoding="utf-8") as f:
        html = f.read()
    html, a = fix_alts(html)
    html, h = fix_hours(html)
    if a or h:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
    total_alt += a
    total_hours += h
    print(f"{path:18} alt+{a:<3} sunday+{h}")
print(f"\nTOTAL: {total_alt} alt attributes set, {total_hours} Sunday-closed entries added")
