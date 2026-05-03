/**
 * سلايدر الهيرو الرئيسي (3 شرائح) — Swiper + parallax خفيف، متوافق مع CSP.
 * الموبايل: تمرير أسهل (threshold / longSwipesRatio)، تحديث بعد resize / visualViewport.
 */
(function () {
  'use strict';
  var inst = null;
  var resizeTimer = null;

  function debounceResize(fn, ms) {
    return function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fn, ms);
    };
  }

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
      speed: reduce ? 320 : 640,
      rtl: true,
      grabCursor: true,
      observer: true,
      observeParents: true,
      watchOverflow: true,
      /* روابط الهيرو (واتساب / إنستغرام) — لا يمنع المتصفح النقر */
      touchStartPreventDefault: false,
      parallax: !reduce,
      watchSlidesProgress: true,
      slidesPerView: 1,
      spaceBetween: 0,
      /* تمرير أسهل على اللمس (موبايل) */
      threshold: 6,
      longSwipesRatio: 0.32,
      breakpoints: {
        601: {
          speed: reduce ? 350 : 700
        }
      },
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
        dynamicBullets: true,
        dynamicMainBullets: 1
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
        },
        resize: function () {
          try {
            this.update();
          } catch (e3) {}
        }
      }
    });

    var onWinResize = debounceResize(function () {
      if (!inst) return;
      try {
        inst.update();
      } catch (e4) {}
    }, 120);
    window.addEventListener('resize', onWinResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onWinResize, { passive: true });
    }

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
