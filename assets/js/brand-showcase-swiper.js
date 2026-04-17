/**
 * سلايدر العلامات / البنرات (Swiper منفصل، RTL، نقاط في المنتصف).
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
  /** مسار الصورة مع احترام meta pharma-base-path (مجلد فرعي على الاستضافة). */
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
  var brandSwiperInstance = null;
  var brandRefreshTimer = null;
  function scheduleBrandRefresh() {
    if (!brandSwiperInstance) return;
    clearTimeout(brandRefreshTimer);
    brandRefreshTimer = setTimeout(function () {
      brandSwiperInstance.update();
      try {
        if (brandSwiperInstance.autoplay && typeof brandSwiperInstance.autoplay.start === 'function') {
          brandSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    }, 80);
  }
  document.querySelectorAll('.brand-showcase-img').forEach(function (img) {
    var primary = img.getAttribute('src');
    if (primary) primary = resolveSlideSrc(primary);
    var fb = img.getAttribute('data-fallback');
    if (fb) fb = resolveSlideSrc(fb);
    img.addEventListener('load', scheduleBrandRefresh, { once: true });
    img.addEventListener(
      'error',
      function onBrandErr() {
        img.removeEventListener('error', onBrandErr);
        if (fb && img.currentSrc !== fb) {
          img.src = fb;
          img.removeAttribute('data-fallback');
          img.addEventListener('load', scheduleBrandRefresh, { once: true });
        }
      },
      { once: true }
    );
    if (primary) img.src = primary;
  });

  function initBrandShowcaseSwiper() {
    if (brandSwiperInstance) return true;
    var root = document.querySelector('.brand-showcase-swiper');
    if (!root || typeof Swiper === 'undefined') return false;
    var pagEl = root.querySelector('.brand-showcase-pagination');
    var nextEl = root.querySelector('.brand-showcase-next');
    var prevEl = root.querySelector('.brand-showcase-prev');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    var slideSpeed = reduceMotion ? 200 : narrow ? 660 : 520;

    function pinBrandPaginationCenter() {
      var el = root.querySelector('.brand-showcase-pagination');
      if (!el) return;
      el.style.setProperty('left', '50%', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('transform', 'translateX(-50%)', 'important');
      el.style.setProperty('width', 'max-content', 'important');
    }

    brandSwiperInstance = new Swiper(root, {
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
        el: pagEl || '.brand-showcase-pagination',
        clickable: true,
        dynamicBullets: false
      },
      navigation: {
        nextEl: nextEl || '.brand-showcase-next',
        prevEl: prevEl || '.brand-showcase-prev'
      },
      keyboard: { enabled: true, onlyInViewport: true },
      on: {
        init: function () {
          var inst = this;
          pinBrandPaginationCenter();
          requestAnimationFrame(function () {
            pinBrandPaginationCenter();
            inst.update();
            try {
              if (inst.autoplay && typeof inst.autoplay.start === 'function') inst.autoplay.start();
            } catch (e) {}
            requestAnimationFrame(pinBrandPaginationCenter);
          });
        },
        slideChangeTransitionEnd: pinBrandPaginationCenter,
        resize: pinBrandPaginationCenter,
        paginationUpdate: pinBrandPaginationCenter
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      try {
        var ro = new ResizeObserver(function () {
          pinBrandPaginationCenter();
          if (brandSwiperInstance) brandSwiperInstance.update();
        });
        ro.observe(root);
      } catch (e) {}
    }

    window.addEventListener('load', function () {
      if (!brandSwiperInstance) return;
      brandSwiperInstance.update();
      pinBrandPaginationCenter();
      try {
        if (brandSwiperInstance.autoplay && typeof brandSwiperInstance.autoplay.start === 'function') {
          brandSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    });
    return true;
  }

  if (!initBrandShowcaseSwiper()) {
    window.addEventListener('load', function () {
      if (!initBrandShowcaseSwiper()) setTimeout(initBrandShowcaseSwiper, 250);
    });
  }
})();
