#!/usr/bin/env python3
"""
Reconstruct the two JS-rendered Squarespace blocks that don't survive a static
mirror so the self-hosted copy matches the live site:

  * the Google map block (in the footer of every page) -> a real Google Maps
    embed iframe at the restaurant's coordinates;
  * the contact-page React form -> a plain HTML form (First/Last name, Email,
    Message + SEND) styled to match, submitting via mailto as a no-backend
    default.

Run from websites/la-lasagna/.  Idempotent.
"""
import glob
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent

# --- map block config (read from the static block's data-context) ---
MAP_LAT, MAP_LNG, MAP_ZOOM = 60.1634999, 24.9425606, 16
MAP_SRC = (f"https://maps.google.com/maps?q={MAP_LAT},{MAP_LNG}"
           f"&z={MAP_ZOOM}&hl=en&output=embed")

CONTACT_EMAIL = "lalasagnahelsinki@gmail.com"

# Squarespace reveals scroll/entrance-animated elements by adding a "booted"
# state / ".loaded" class via JS. Statically that JS may not fire, leaving some
# text/images stuck at opacity:0. Force every animated element to its final
# visible state so the mirror renders deterministically without that JS.
REVEAL_CSS = """
[data-animation-role]{opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important;visibility:visible!important;}
.page-section[data-animation]{opacity:1!important;transform:none!important;clip-path:none!important;}
.sqs-gallery-block-grid img,.product-gallery-slides-item-image,.product-gallery-thumbnails-item,.summary-thumbnail-image{opacity:1!important;}
[class*="preFlex"],[class*="flexIn"]{opacity:1!important;transform:none!important;clip-path:none!important;}
.sqsrte-scaled-text-container{opacity:1!important;}
/* Squarespace shape blocks (website.components.shape) are sized by remote
   component CSS/JS; statically the inner .sqs-shape collapses to 0x0. Force it
   to fill its (correctly-sized) container so the colour/shape renders. */
.sqs-shape{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}
.sqs-shape>.sqs-shape-fill,.sqs-shape svg{width:100%!important;height:100%!important;}
""".strip()

FORM_CSS = """
.lala-form{max-width:100%;}
.lala-form .lala-field-label{display:block;color:#f7f3e3;font-size:.95rem;margin:0 0 .4rem;}
.lala-form .lala-field-label .req{opacity:.6;font-weight:400;margin-left:.3rem;}
.lala-form .lala-row{display:flex;gap:18px;}
.lala-form .lala-row>div{flex:1;}
.lala-form .lala-section{color:#f7f3e3;font-size:1rem;margin:0 0 .5rem;}
.lala-form .lala-help{color:#cfc9b3;font-size:.8rem;margin:.1rem 0 .5rem;}
.lala-form input,.lala-form textarea{width:100%;border:0;background:#e7e4d3;color:#1a1a1a;
  padding:11px 12px;font-size:1rem;font-family:inherit;box-sizing:border-box;border-radius:2px;}
.lala-form input:focus,.lala-form textarea:focus{outline:2px solid #c9c4ad;}
.lala-form textarea{min-height:150px;resize:vertical;}
.lala-form .lala-block{margin-bottom:20px;}
.lala-form .lala-send{margin-top:8px;background:transparent;color:#f7f3e3;border:1px solid #b9b39a;
  padding:10px 26px;font-size:.95rem;letter-spacing:.06em;cursor:pointer;border-radius:2px;
  font-family:inherit;text-transform:uppercase;}
.lala-form .lala-send:hover{background:#f7f3e3;color:#1a1a1a;}
""".strip()


# Squarespace auto-scales ".sqsrte-scaled-text" headings to fill their container
# width via JS that wraps the text in a sized <span> and adds ".loaded". That JS
# doesn't run reliably in the static mirror, so some headings (e.g. "Freshly
# baking") disappear. This self-contained script reproduces the behaviour with no
# external dependency.
SCALED_TEXT_JS = """
(function(){
  function fit(c){
    var span=c.querySelector(':scope > .sqsrte-scaled-text');
    if(!span){
      span=document.createElement('span');
      span.className='sqsrte-scaled-text';
      span.style.display='inline-block';
      while(c.firstChild){ span.appendChild(c.firstChild); }
      c.appendChild(span);
    }
    span.style.fontSize='100px';
    var cw=c.clientWidth, sw=span.scrollWidth;
    if(sw>0 && cw>0){ span.style.fontSize=(Math.round(100*cw/sw*100)/100)+'px'; }
    c.classList.add('loaded');
  }
  function run(){ document.querySelectorAll('.sqsrte-scaled-text-container').forEach(fit); }
  if(document.readyState!=='loading'){ run(); }
  else { document.addEventListener('DOMContentLoaded', run); }
  window.addEventListener('load', run);
  var t; window.addEventListener('resize', function(){ clearTimeout(t); t=setTimeout(run,150); });
})();
""".strip()


def build_form(soup):
    form = soup.new_tag("form", attrs={
        "class": "lala-form",
        "action": f"mailto:{CONTACT_EMAIL}",
        "method": "post",
        "enctype": "text/plain",
    })

    def label(text):
        lab = soup.new_tag("label", attrs={"class": "lala-field-label"})
        lab.append(text + " ")
        req = soup.new_tag("span", attrs={"class": "req"})
        req.string = "(required)"
        lab.append(req)
        return lab

    def field(block, label_text, tag, **attrs):
        lab = label(label_text)
        el = soup.new_tag(tag, attrs=attrs)
        block.append(lab)
        block.append(el)
        return block

    # Name section
    name_block = soup.new_tag("div", attrs={"class": "lala-block"})
    sec = soup.new_tag("div", attrs={"class": "lala-section"})
    sec.string = "Name"
    name_block.append(sec)
    row = soup.new_tag("div", attrs={"class": "lala-row"})
    row.append(field(soup.new_tag("div"), "First Name", "input",
                     type="text", name="First Name", required=""))
    row.append(field(soup.new_tag("div"), "Last Name", "input",
                     type="text", name="Last Name", required=""))
    name_block.append(row)
    form.append(name_block)

    # Email
    email_block = soup.new_tag("div", attrs={"class": "lala-block"})
    field(email_block, "Email", "input", type="email", name="Email", required="")
    form.append(email_block)

    # Message
    msg_block = soup.new_tag("div", attrs={"class": "lala-block"})
    msg_block.append(label("Message"))
    help_ = soup.new_tag("div", attrs={"class": "lala-help"})
    help_.string = "For reservations please include: Date, Time and Persons"
    msg_block.append(help_)
    ta = soup.new_tag("textarea", attrs={"name": "Message", "required": ""})
    msg_block.append(ta)
    form.append(msg_block)

    # Send
    btn = soup.new_tag("button", attrs={"type": "submit", "class": "lala-send"})
    btn.string = "SEND"
    form.append(btn)
    return form


def fix_maps(soup):
    n = 0
    for block in soup.find_all(class_="sqs-block-map"):
        content = block.find(class_="sqs-block-content") or block
        content.clear()
        wrap = soup.new_tag("div", attrs={
            "class": "lala-map",
            "style": "position:relative;width:100%;height:100%;min-height:100%;overflow:hidden;",
        })
        iframe = soup.new_tag("iframe", attrs={
            "src": MAP_SRC, "loading": "lazy",
            "referrerpolicy": "no-referrer-when-downgrade",
            "style": ("position:absolute;inset:0;width:100%;height:100%;"
                      "border:0;display:block;"),
            "title": "La Lasagna location map",
        })
        wrap.append(iframe)
        content.append(wrap)
        n += 1
    return n


def main():
    for f in sorted(glob.glob(str(ROOT / "*.html"))):
        soup = BeautifulSoup(open(f, encoding="utf-8").read(), "lxml")
        changed = []
        m = fix_maps(soup)
        if m:
            changed.append(f"{m} map(s)")

        fb = soup.find(class_="sqs-block-form")
        if fb is not None:
            content = fb.find(class_="sqs-block-content") or fb
            # only rebuild if not already done
            if not content.find(class_="lala-form"):
                content.clear()
                content.append(build_form(soup))
                changed.append("form")

        # inject form css once (only needed on pages with the form, but harmless)
        if soup.find(class_="lala-form") and not soup.find("style", id="lala-form-css"):
            st = soup.new_tag("style", id="lala-form-css")
            st.string = FORM_CSS
            (soup.head or soup).append(st)

        # force-reveal animated elements (once per page)
        if not soup.find("style", id="lala-reveal-css"):
            st = soup.new_tag("style", id="lala-reveal-css")
            st.string = REVEAL_CSS
            (soup.head or soup).append(st)
            changed.append("reveal-css")

        # scaled-text auto-fit script (once per page)
        if soup.find(class_="sqsrte-scaled-text-container") and \
                not soup.find("script", id="lala-scaledtext-js"):
            sc = soup.new_tag("script", id="lala-scaledtext-js")
            sc.string = SCALED_TEXT_JS
            (soup.body or soup).append(sc)
            changed.append("scaledtext-js")

        if changed:
            Path(f).write_text(str(soup), encoding="utf-8")
            print(f"{Path(f).name}: {', '.join(changed)}")


if __name__ == "__main__":
    main()
