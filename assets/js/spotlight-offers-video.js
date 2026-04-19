/**
 * قسم «عروض ومنتجات مختارة»: صورة ثابتة أولاً ثم تلاشٍ إلى الفيديو عند التشغيل.
 */
(function () {
  var root = document.getElementById('spotlightVideoStage');
  var v = document.getElementById('spotlightOffersVideo');
  if (!root || !v) return;

  var done = false;
  function reveal() {
    if (done) return;
    done = true;
    root.classList.add('is-playing');
  }

  v.addEventListener('playing', reveal);
  v.addEventListener('timeupdate', function onTime() {
    if (v.currentTime > 0.03) {
      reveal();
      v.removeEventListener('timeupdate', onTime);
    }
  });

  v.addEventListener('error', function () {
    root.classList.add('is-still');
  });

  if (v.play) {
    var playAttempt = v.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(function () {});
    }
  }

  if (v.readyState >= 2 && !v.paused) reveal();
})();
