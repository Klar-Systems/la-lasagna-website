/* La Lasagna — pizza page: tap the bottom pizza videos to open them FULLSCREEN.
   The two clips are landscape (1920x1080) but render as a small strip on mobile.
   On tap we enter native fullscreen so they play big and horizontal. iOS Safari
   doesn't support element.requestFullscreen() on arbitrary elements, but <video>
   supports webkitEnterFullscreen(), so we fall back to that. Desktop is left as-is
   (this only wires up on touch/small screens). Self-contained; no deps. */
(function () {
  var BLOCKS = [
    'fe-block-yui_3_17_2_1_1774362642002_340643',
    'fe-block-yui_3_17_2_1_1774362642002_299904'
  ];

  function goFullscreen(v) {
    // Show native controls once the user has chosen to open it big.
    v.controls = true;
    v.muted = false;
    var p = null;
    if (v.requestFullscreen) p = v.requestFullscreen();
    else if (v.webkitRequestFullscreen) p = v.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); }   // iOS
    else if (v.msRequestFullscreen) p = v.msRequestFullscreen();
    if (p && p.catch) p.catch(function () { try { v.webkitEnterFullscreen && v.webkitEnterFullscreen(); } catch (e) {} });
    // best-effort landscape lock while fullscreen (supported on some Androids)
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function(){}); } catch (e) {}
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
  }

  function onExitRestore() {
    // when the user leaves fullscreen, return the clip to its silent-loop state
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) return;
    BLOCKS.forEach(function (cls) {
      var b = document.querySelector('.' + cls); if (!b) return;
      var v = b.querySelector('video'); if (!v) return;
      v.controls = false; v.muted = true;
    });
  }

  function wire() {
    BLOCKS.forEach(function (cls) {
      var b = document.querySelector('.' + cls); if (!b) return;
      var v = b.querySelector('video'); if (!v || v.__lalaFs) return;
      v.__lalaFs = true;
      b.style.cursor = 'pointer';
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', 'Play video fullscreen');
      // a tap on the block (or the video) opens fullscreen
      b.addEventListener('click', function (ev) { ev.preventDefault(); goFullscreen(v); });
    });
    document.addEventListener('fullscreenchange', onExitRestore);
    document.addEventListener('webkitfullscreenchange', onExitRestore);
  }

  if (document.readyState !== 'loading') wire();
  else document.addEventListener('DOMContentLoaded', wire);
  // videos load a touch late in the mirror; re-wire once more after load
  window.addEventListener('load', wire);
})();
