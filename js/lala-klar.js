/* La Lasagna — glue between the site's EN/FI switch and the Klar embed.

   The embed renders its own copy in the locale it is mounted with; the site's
   switcher (js/lala-lang.js) walks text nodes against a dictionary that knows
   nothing about the embed's strings. So instead of translating the widget, we
   re-mount it in the other language: klar-embed.js only mounts elements without
   data-klar-mounted, so replacing the mount with a fresh node and re-appending
   the script re-runs it in the new locale.

   Must load BEFORE klar-embed.js so the first mount already carries the stored
   language. */
(function () {
  'use strict';

  var LANG_KEY = 'lala-lang';
  var EMBED_SRC = 'klar-embed.js';

  /* Strings this page introduced, which the site dictionary (captured before it
     existed) cannot know: the nav word and the dish lines that are not printed
     on lalasagnahelsinki.com. Everything the site DOES print — the pizza and
     salad descriptions — is left to js/lala-lang.js, so the demo shows La
     Lasagna's own Finnish rather than a second translation of it. */
  var EXTRA = {
    'Order': 'Tilaa',
    'Classic beef bolognese lasagna, baked fresh': 'Klassinen bolognese-lasagne, paistettu tuoreena',
    'Pesto and potato lasagna': 'Pesto-perunalasagne',
    'Baked mushroom lasagna': 'Sienilasagne',
    'Baked vegetable lasagna': 'Kasvislasagne',
    'Baked spinach and cheese lasagna': 'Pinaatti-juustolasagne',
    'Baked Italian sausage lasagna': 'Italialainen makkaralasagne',
    'Baked chicken lasagna': 'Kanalasagne',
    'Baked pepperoni lasagna': 'Peparonilasagne',
    'Baked tuna and mushroom lasagna': 'Tonnikala-sienilasagne',
    'Baked eggplant and tomato lasagna (gluten-free, vegetarian)':
      'Munakoiso-tomaattilasagne (gluteeniton, kasvis)',
    'Baked meat cannelloni': 'Liha-cannelloni',
    'Ricotta and spinach cannelloni': 'Ricotta-pinaatticannelloni',
    'Choose from: strawberry, salted caramel, raspberry, chocolate':
      'Valitse seuraavista: mansikka, suolainen karamelli, vadelma, suklaa'
  };

  function applyExtra(lang) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var raw = n.nodeValue;
      var trimmed = raw.trim();
      if (!trimmed) continue;
      if (lang === 'fi') {
        var fi = EXTRA[trimmed];
        if (fi && n.__lalaKlarEn == null) {
          n.__lalaKlarEn = raw;
          n.nodeValue = raw.replace(trimmed, fi);
        }
      } else if (n.__lalaKlarEn != null) {
        n.nodeValue = n.__lalaKlarEn;
        n.__lalaKlarEn = null;
      }
    }
  }

  function stored() {
    try {
      return localStorage.getItem(LANG_KEY) === 'fi' ? 'fi' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function mounts() {
    return [].slice.call(document.querySelectorAll('[data-klar-slug],[data-klar-order-slug],[data-klar-book-slug]'));
  }

  function applyLocale(lang) {
    mounts().forEach(function (el) {
      el.setAttribute('data-klar-locale', lang);
    });
  }

  /* Copy written for this page (the site dictionary only knows the strings that
     existed when it was captured). data-lala-fi holds the Finnish; the English
     already in the element is kept in data-lala-en on the first swap. */
  function applyCopy(lang) {
    [].slice.call(document.querySelectorAll('[data-lala-fi]')).forEach(function (el) {
      if (el.getAttribute('data-lala-en') == null) el.setAttribute('data-lala-en', el.textContent);
      el.textContent = el.getAttribute(lang === 'fi' ? 'data-lala-fi' : 'data-lala-en');
    });
  }

  /* The dish descriptions inside the widget are the same English sentences the
     site's own dictionary already translates — but the widget renders them long
     after lala-lang.js has walked the page, and again on every re-mount. Asking
     the switcher to re-run is one click on its own (hidden) option element; it
     re-walks text nodes and leaves everything already translated alone. */
  function retranslate() {
    var lang = document.documentElement.getAttribute('lang') === 'fi' ? 'fi' : 'en';
    if (lang !== 'fi') return;
    var opt = document.querySelector('.lala-lang-opt[data-lang="fi"]');
    if (opt) opt.click();
    applyExtra('fi');
  }

  var pending = null;
  function watchMounts() {
    mounts().forEach(function (el) {
      if (el.__lalaWatched) return;
      el.__lalaWatched = true;
      new MutationObserver(function () {
        clearTimeout(pending);
        pending = setTimeout(retranslate, 350);
      }).observe(el, { childList: true, subtree: true });
    });
  }

  /* first paint: the stored choice, before the embed boots */
  applyLocale(stored());
  applyCopy(stored());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchMounts);
  } else {
    watchMounts();
  }

  /* A re-mount carries what the guest had typed: the old mount hands over a
     snapshot (klar-embed.js, klarSnapshot) and the new one picks it up from
     `klarRestore`. It used to throw the date, the time and every field away
     (klar-console audit 2026-11-19, WIDGET-17).

     Two states are left in the language they are in. A booking in flight:
     its answer would land on a node no longer in the page, and the guest
     would see an empty form instead of a confirmation. And a result on screen
     — "check your email", "table booked" — which is the guest's record. Both
     re-mount once the embed says the form is free again ('klar:settled'). */
  var waiting = false;
  function remount(lang) {
    var changed = false;
    mounts().forEach(function (el) {
      if (el.getAttribute('data-klar-locale') === lang && el.dataset.klarMounted !== '1') return;
      var snap = null;
      try {
        snap = typeof el.klarSnapshot === 'function' ? el.klarSnapshot() : null;
      } catch (e) {
        snap = null;
      }
      if (snap && (snap.busy || snap.done)) {
        waiting = true;
        return;
      }
      var fresh = document.createElement('div');
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name === 'data-klar-mounted') continue;
        fresh.setAttribute(a.name, a.value);
      }
      fresh.setAttribute('data-klar-locale', lang);
      if (snap) fresh.klarRestore = snap;
      el.parentNode.replaceChild(fresh, el);
      changed = true;
    });
    if (!changed) return;
    var s = document.createElement('script');
    s.src = EMBED_SRC + '?lang=' + lang;
    s.onload = watchMounts;
    document.body.appendChild(s);
  }
  document.addEventListener('klar:settled', function () {
    if (!waiting) return;
    waiting = false;
    /* Let the embed finish drawing its answer before the form is replaced. */
    setTimeout(function () { remount(last); }, 0);
  });

  /* lala-lang.js sets <html lang> on every switch and does not reload the page */
  var last = document.documentElement.getAttribute('lang') || 'en';
  new MutationObserver(function () {
    var now = document.documentElement.getAttribute('lang') === 'fi' ? 'fi' : 'en';
    if (now === last) return;
    last = now;
    applyCopy(now);
    applyExtra(now);
    remount(now);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
