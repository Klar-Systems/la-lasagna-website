#!/usr/bin/env python3
"""Generate js/lala-lang.js (embedded EN->FI dict + offline language switcher) and
inject it into all 9 mirror pages. Self-contained: no Weglot, no network."""
import json, re, glob
from pathlib import Path
from bs4 import BeautifulSoup

SCRATCH = Path(__file__).resolve().parent
SITE = Path(r"c:\Users\edvin\projects\klar-pipeline\websites\la-lasagna")

raw = json.load(open(SCRATCH / "finnish_dict.json", encoding="utf-8"))

def norm(s):
    return re.sub(r"\s+", " ", s).strip()

# normalize keys, drop empties, fix the one clear Weglot context error
dic = {}
for en, fi in raw.items():
    k = norm(en)
    if k and norm(fi) and k not in dic:
        dic[k] = fi
dic["Book"] = "Varaa"  # Weglot rendered the booking button "Book" as "Kirja" (a novel)

dict_json = json.dumps(dic, ensure_ascii=False, separators=(",", ":"))

JS = r"""/* La Lasagna — self-contained EN/FI language switcher (replaces Weglot).
   Walks visible text nodes and swaps English<->Finnish from an embedded dictionary
   captured from the live site. Choice persists across pages via localStorage. */
(function(){
  var DICT = __DICT__;
  var KEY = 'lala-lang';
  function norm(s){ return s.replace(/\s+/g,' ').trim(); }
  function skip(p){
    while(p){
      var tn=p.nodeName;
      if(tn==='SCRIPT'||tn==='STYLE'||tn==='NOSCRIPT'||tn==='TEMPLATE') return true;
      if(p.classList && p.classList.contains('lala-no-translate')) return true;
      p=p.parentElement;
    }
    return false;
  }
  function textNodes(){
    var w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var a=[],n;
    while(n=w.nextNode()){ if(n.nodeValue && n.nodeValue.trim() && !skip(n.parentElement)) a.push(n); }
    return a;
  }
  function toFI(){
    textNodes().forEach(function(n){
      var t=n.nodeValue, tr=t.trim(), fi=DICT[norm(tr)];
      if(fi){ if(n.__en==null) n.__en=t; n.nodeValue=t.replace(tr, fi); }
    });
  }
  function toEN(){ textNodes().forEach(function(n){ if(n.__en!=null) n.nodeValue=n.__en; }); }
  function label(l){ return l==='fi' ? 'Suomi' : 'English'; }
  function updateUI(l){
    var names=document.querySelectorAll('.current-language-name');
    for(var i=0;i<names.length;i++) names[i].textContent=label(l);
    var opts=document.querySelectorAll('.lala-lang-opt');
    for(var j=0;j<opts.length;j++)
      opts[j].setAttribute('aria-selected', opts[j].getAttribute('data-lang')===l ? 'true':'false');
  }
  function setLang(l, save){
    if(l==='fi') toFI(); else toEN();
    document.documentElement.setAttribute('lang', l==='fi' ? 'fi':'en');
    if(save!==false){ try{ localStorage.setItem(KEY,l); }catch(e){} }
    updateUI(l);
  }
  var openMenu=null;
  function closeMenu(){ if(openMenu){ openMenu.classList.remove('open'); openMenu=null; } }
  function options(makeEl){
    return [['fi','Suomi'],['en','English']].map(function(o){
      var el=makeEl(); el.className=(el.className+' lala-lang-opt').trim();
      el.setAttribute('data-lang',o[0]); el.textContent=o[1];
      el.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); setLang(o[0]); closeMenu(); });
      return el;
    });
  }
  function buildDesktop(){
    var p=document.getElementById('multilingual-language-picker-desktop'); if(!p) return;
    p.classList.add('lala-no-translate');
    var menu=document.createElement('div'); menu.className='lala-lang-menu';
    options(function(){ var b=document.createElement('button'); b.type='button'; return b; })
      .forEach(function(b){ menu.appendChild(b); });
    p.appendChild(menu);
    p.addEventListener('click', function(ev){
      ev.stopPropagation();
      var willOpen=!menu.classList.contains('open'); closeMenu();
      if(willOpen){ menu.classList.add('open'); openMenu=menu; p.setAttribute('aria-expanded','true'); }
      else p.setAttribute('aria-expanded','false');
    });
  }
  function buildMobile(){
    var m=document.getElementById('multilingual-language-picker-mobile'); if(!m) return;
    m.classList.add('lala-no-translate');
    var c=m.querySelector('.language-picker-content')||m;
    options(function(){ var a=document.createElement('a'); a.href='#'; a.className='lala-lang-opt-mobile'; return a; })
      .forEach(function(a){ c.appendChild(a); });
  }
  function buildStyle(){
    var css=''
      +'.lala-lang-menu{display:none;position:absolute;top:100%;left:0;margin-top:4px;background:none;'
      +'border:0;box-shadow:none;z-index:99999;white-space:nowrap;}'
      +'.lala-lang-menu.open{display:block;}'
      +'.lala-lang-menu .lala-lang-opt{display:block;width:auto;text-align:left;padding:1.6px 0;background:none;'
      +'border:0;font-family:inherit;font-weight:700;font-size:16px;line-height:1.2;color:rgb(249,252,224);cursor:pointer;}'
      +'.lala-lang-menu .lala-lang-opt:hover{opacity:.72;}'
      +'#multilingual-language-picker-desktop{position:relative;cursor:pointer;}'
      +'#multilingual-language-picker-mobile .lala-lang-opt-mobile{display:block;padding:1.6px 0;color:inherit;'
      +'text-decoration:none;font-weight:700;font-size:1em;}';
    var st=document.createElement('style'); st.textContent=css; (document.head||document.body).appendChild(st);
  }
  document.addEventListener('click', closeMenu);
  function init(){
    buildStyle(); buildDesktop(); buildMobile();
    var saved='en'; try{ saved=localStorage.getItem(KEY)||'en'; }catch(e){}
    setLang(saved==='fi' ? 'fi':'en', false);
  }
  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
""".replace("__DICT__", dict_json)

(SITE / "js" / "lala-lang.js").write_text(JS, encoding="utf-8")
print(f"wrote js/lala-lang.js ({len(JS)} bytes, {len(dic)} translations)")

# inject into all pages before </body>
for f in sorted(glob.glob(str(SITE / "*.html"))):
    soup = BeautifulSoup(open(f, encoding="utf-8").read(), "lxml")
    if soup.find("script", id="lala-lang-js"):
        continue
    sc = soup.new_tag("script", id="lala-lang-js", src="js/lala-lang.js")
    (soup.body or soup).append(sc)
    Path(f).write_text(str(soup), encoding="utf-8")
    print(f"  injected into {Path(f).name}")
