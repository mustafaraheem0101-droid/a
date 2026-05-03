/**
 * سلايدر الهيرو الرئيسي (3 شرائح) — Swiper + parallax خفيف، متوافق مع CSP.
 */
(function () {
  'use strict';
  var inst = null;
  function init() {
    if (inst) return true;
    var root = document.querySelector('.home-hero-swiper');
    if (!root || typeof Swiper === 'undefined') return false;
    var pag = root.querySelector('.home-hero-pagination');
    var nextEl = root.querySelector('.home-hero-next');
    var prevEl = root.querySelector('.home-hero-prev');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    inst = new Swiper(root, {
      loop: true,
      speed: reduce ? 350 : 720,
      rtl: true,
      grabCursor: true,
      parallax: !reduce,
      watchSlidesProgress: true,
      slidesPerView: 1,
      spaceBetween: 0,
      autoplay: reduce
        ? false
        : {
            delay: 6200,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
            waitForTransition: true
          },
      pagination: {
        el: pag || '.home-hero-pagination',
        clickable: true,
        dynamicBullets: true
      },
      navigation: {
        nextEl: nextEl || '.home-hero-next',
        prevEl: prevEl || '.home-hero-prev'
      },
      keyboard: { enabled: true, onlyInViewport: true },
      on: {
        init: function () {
          try {
            this.update();
          } catch (e) {}
        }
      }
    });

    window.addEventListener(
      'load',
      function () {
        if (!inst) return;
        try {
          inst.update();
          if (inst.autoplay && typeof inst.autoplay.start === 'function') inst.autoplay.start();
        } catch (e2) {}
      },
      { once: true }
    );
    return true;
  }

  if (!init()) {
    window.addEventListener('load', function () {
      if (!init()) setTimeout(init, 200);
    });
  }
})();
