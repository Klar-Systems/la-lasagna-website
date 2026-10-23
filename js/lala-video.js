/* Keep the original clips and autoplay, but fetch them only near the viewport.
   preload="none" alone cannot do this: autoplay takes precedence over it.
   The HTML keeps the original poster/box and a no-JavaScript video fallback.
   Its noscript CSS uses visibility because existing !important display rules
   override display:none; both video elements already occupy the same box. */
(function () {
  'use strict';

  function load(video) {
    var src = video.getAttribute('data-lala-video-src');
    if (!src) return;
    video.removeAttribute('data-lala-video-src');
    video.src = src;
    video.load();
    var playing = video.play();
    // A browser may require a user gesture; retain the poster and normal tap.
    if (playing && playing.catch) playing.catch(function () {});
  }

  var videos = document.querySelectorAll('video[data-lala-video-src]');
  if (!('IntersectionObserver' in window)) {
    videos.forEach(load); // Older browsers retain the previous eager behaviour.
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      load(entry.target);
    });
  }, { rootMargin: '600px 0px' });

  videos.forEach(function (video) {
    observer.observe(video);
    // A direct tap must also work before the observer callback. Capture runs
    // before the existing pizza handler opens native fullscreen and unmutes.
    var target = video.closest('.lala-video-cell') || video;
    target.addEventListener('click', function () { load(video); }, { capture: true, once: true });
  });
})();
