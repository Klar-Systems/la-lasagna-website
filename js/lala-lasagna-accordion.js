/* La Lasagna — menu page: on MOBILE, turn the stack of lasagna photos into a
   dropdown/accordion. Collapsed it shows just the lasagna names; tapping a name
   reveals that lasagna's photo. Desktop is left exactly as authored (photos shown).

   Titles are read from each photo's alt text (everything before the "–"), so the
   list stays correct if photos are added/removed/renamed. Self-contained; no deps. */
(function () {
  var MQ = '(max-width: 767px)';

  // the 12 lasagna photo blocks, in menu order
  var BLOCKS = [
    'fe-block-7eb43b629062e8316f13',
    'fe-block-9e89cd52929f61903268',
    'fe-block-9bf53c46fbfc4173d66e',
    'fe-block-0edda4c7a25bfa576cd7',
    'fe-block-222753de45067fdf77ef',
    'fe-block-be31355165b0de9b1925',
    'fe-block-bb5aab58c909139df52b',
    'fe-block-ba032c8c44deede00445',   // Lasagne al tonno
    'fe-block-df54acb43ee9db4a4ace',   // Parmigiana di melanzane
    'fe-block-e095241aaf88c7bf14db',
    'fe-block-d19f6e8bda8fd0afe15c',
    'fe-block-e3be71dff144c31f59e9'
  ];

  function titleFor(block) {
    var img = block.querySelector('img');
    var alt = (img && img.getAttribute('alt')) || '';
    // "Lasagna X – baked … at La Lasagna Helsinki"  ->  "Lasagna X"
    var name = alt.split('–')[0].split(' - ')[0].trim();
    return name || 'Lasagna';
  }

  var built = false;
  function build() {
    if (built) return;
    var blocks = BLOCKS.map(function (c) { return document.querySelector('.' + c); }).filter(Boolean);
    if (!blocks.length) return;
    built = true;

    blocks.forEach(function (b) {
      if (b.__lalaAcc) return;
      b.__lalaAcc = true;
      var title = titleFor(b);

      // build the toggle button
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lala-acc-btn';
      btn.setAttribute('aria-expanded', 'false');
      var label = document.createElement('span');
      label.className = 'lala-acc-title';
      label.textContent = title;
      var caret = document.createElement('span');
      caret.className = 'lala-acc-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';                 // ▾
      btn.appendChild(label);
      btn.appendChild(caret);

      // insert the button just before the photo block, and mark the block as the panel
      b.parentNode.insertBefore(btn, b);
      b.classList.add('lala-acc-panel');
      b.__lalaBtn = btn;

      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        var open = b.classList.toggle('lala-acc-open');
        btn.classList.toggle('lala-acc-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function teardown() {
    // remove the injected buttons + classes so desktop is pristine again
    document.querySelectorAll('.lala-acc-btn').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.lala-acc-panel').forEach(function (p) {
      p.classList.remove('lala-acc-panel', 'lala-acc-open');
      p.__lalaAcc = false; p.__lalaBtn = null;
    });
    built = false;
  }

  function apply(mql) {
    if (mql.matches) build(); else teardown();
  }

  function injectStyle() {
    if (document.getElementById('lala-acc-css')) return;
    var css = ''
      + '@media (max-width:767px){'
      // the lasagna photos live in a CSS grid; when we inject accordion buttons we
      // need them to flow in a normal column, so switch that engine to a flex column
      + 'section[data-section-id="6989f0bc5e0b8e771afd5340"] .fluid-engine{'
      + 'display:flex !important;flex-direction:column !important;align-items:stretch !important;'
      + 'gap:0 !important;grid-template-rows:none !important;grid-template-columns:none !important;}'
      + 'section[data-section-id="6989f0bc5e0b8e771afd5340"] .fluid-engine>.fe-block{'
      + 'grid-area:auto !important;grid-row:auto !important;grid-column:auto !important;'
      + 'width:100% !important;max-width:100% !important;height:auto !important;transform:none !important;}'
      // plain titles styled like the Pizzas menu items (red, Sansita, no box) —
      // just a caret to show they open. No border, no background.
      + '.lala-acc-btn{display:flex;align-items:center;justify-content:center;gap:10px;'
      + 'width:100%;margin:22px auto 0;padding:0;background:none;border:0;border-radius:0;'
      + 'color:#e41e25;font-family:inherit;font-weight:700;font-size:1.95rem;line-height:1.15;'
      + 'text-align:center;cursor:pointer;box-sizing:border-box;}'
      + '.lala-acc-title{flex:0 1 auto;}'
      + '.lala-acc-caret{flex:0 0 auto;font-size:.5em;line-height:1;transition:transform .18s ease;opacity:.75;}'
      + '.lala-acc-btn.lala-acc-open .lala-acc-caret{transform:rotate(180deg);}'
      // panel (the photo block): hidden until its button is opened
      + '.lala-acc-panel{display:none !important;}'
      + '.lala-acc-panel.lala-acc-open{display:block !important;margin-top:8px !important;}'
      + '}';
    var st = document.createElement('style');
    st.id = 'lala-acc-css';
    st.textContent = css;
    (document.head || document.body).appendChild(st);
  }

  function init() {
    injectStyle();
    var mql = window.matchMedia(MQ);
    apply(mql);
    // react to viewport changes (rotate / resize across the breakpoint)
    if (mql.addEventListener) mql.addEventListener('change', function () { apply(mql); });
    else if (mql.addListener) mql.addListener(function () { apply(mql); });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', function () { var m = window.matchMedia(MQ); if (m.matches) build(); });
})();
