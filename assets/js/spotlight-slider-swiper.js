/**
 * سلايدر البنرات الإضافية — تحت «منتجات وعلاجات مختارة» (Swiper RTL، نفس سلوك brand-showcase).
 */
(function () {
  'use strict';
  var base = typeof document !== 'undefined' && document.baseURI ? document.baseURI : window.location.href;
  function absUrl(rel) {
    if (!rel || /^(?:https?:|data:|blob:)/i.test(rel)) return rel;
    try {
      return new URL(rel, base).href;
    } catch (e) {
      return rel;
    }
  }
  function resolveSlideSrc(rel) {
    if (!rel) return rel;
    var t = String(rel).trim();
    if (/^(?:https?:|data:|blob:)/i.test(t)) return t;
    if (typeof pharmaPublicAssetUrl === 'function') {
      var u = pharmaPublicAssetUrl(t.replace(/^\//, ''));
      if (u) return u;
    }
    return absUrl(t);
  }
  var spotlightSwiperInstance = null;
  var spotlightRefreshTimer = null;
  function scheduleSpotlightRefresh() {
    if (!spotlightSwiperInstance) return;
    clearTimeout(spotlightRefreshTimer);
    spotlightRefreshTimer = setTimeout(function () {
      spotlightSwiperInstance.update();
      try {
        if (spotlightSwiperInstance.autoplay && typeof spotlightSwiperInstance.autoplay.start === 'function') {
          spotlightSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    }, 80);
  }
  document.querySelectorAll('.spotlight-slider-img').forEach(function (img) {
    var primary = img.getAttribute('src');
    if (primary) primary = resolveSlideSrc(primary);
    var fb = img.getAttribute('data-fallback');
    if (fb) fb = resolveSlideSrc(fb);
    img.addEventListener('load', scheduleSpotlightRefresh, { once: true });
    img.addEventListener(
      'error',
      function onSpotErr() {
        img.removeEventListener('error', onSpotErr);
        if (fb && img.currentSrc !== fb) {
          img.src = fb;
          img.removeAttribute('data-fallback');
          img.addEventListener('load', scheduleSpotlightRefresh, { once: true });
        }
      },
      { once: true }
    );
    if (primary) img.src = primary;
  });

  function initSpotlightSliderSwiper() {
    if (spotlightSwiperInstance) return true;
    var root = document.querySelector('.spotlight-slider-swiper');
    if (!root || typeof Swiper === 'undefined') return false;
    var pagEl = root.querySelector('.spotlight-slider-pagination');
    var nextEl = root.querySelector('.spotlight-slider-next');
    var prevEl = root.querySelector('.spotlight-slider-prev');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    var slideSpeed = reduceMotion ? 200 : narrow ? 660 : 520;

    function pinSpotlightPaginationCenter() {
      var el = root.querySelector('.spotlight-slider-pagination');
      if (!el) return;
      el.style.setProperty('left', '50%', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('transform', 'translateX(-50%)', 'important');
      el.style.setProperty('width', 'max-content', 'important');
    }

    spotlightSwiperInstance = new Swiper(root, {
      loop: false,
      rewind: true,
      speed: slideSpeed,
      resistanceRatio: narrow ? 0.58 : 0.85,
      longSwipesRatio: narrow ? 0.32 : 0.5,
      rtl: true,
      grabCursor: true,
      watchSlidesProgress: false,
      observer: true,
      observeParents: true,
      observeSlideChildren: true,
      centeredSlides: false,
      slidesPerView: 1,
      spaceBetween: 0,
      autoHeight: true,
      breakpoints: {
        769: {
          autoHeight: false
        }
      },
      autoplay: {
        delay: 2000,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
        waitForTransition: true
      },
      pagination: {
        el: pagEl || '.spotlight-slider-pagination',
        clickable: true,
        dynamicBullets: false
      },
      navigation: {
        nextEl: nextEl || '.spotlight-slider-next',
        prevEl: prevEl || '.spotlight-slider-prev'
      },
      keyboard: { enabled: true, onlyInViewport: true },
      on: {
        init: function () {
          var inst = this;
          pinSpotlightPaginationCenter();
          requestAnimationFrame(function () {
            pinSpotlightPaginationCenter();
            inst.update();
            try {
              if (inst.autoplay && typeof inst.autoplay.start === 'function') inst.autoplay.start();
            } catch (e) {}
            requestAnimationFrame(pinSpotlightPaginationCenter);
          });
        },
        slideChangeTransitionEnd: pinSpotlightPaginationCenter,
        resize: pinSpotlightPaginationCenter,
        paginationUpdate: pinSpotlightPaginationCenter
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      try {
        var ro = new ResizeObserver(function () {
          pinSpotlightPaginationCenter();
          if (spotlightSwiperInstance) spotlightSwiperInstance.update();
        });
        ro.observe(root);
      } catch (e) {}
    }

    window.addEventListener('load', function () {
      if (!spotlightSwiperInstance) return;
      spotlightSwiperInstance.update();
      pinSpotlightPaginationCenter();
      try {
        if (spotlightSwiperInstance.autoplay && typeof spotlightSwiperInstance.autoplay.start === 'function') {
          spotlightSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    });
    return true;
  }

  if (!initSpotlightSliderSwiper()) {
    window.addEventListener('load', function () {
      if (!initSpotlightSliderSwiper()) setTimeout(initSpotlightSliderSwiper, 250);
    });
  }
})();
