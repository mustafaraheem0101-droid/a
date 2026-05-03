/**
 * سلايدر الهيرو الرئيسي (3 شرائح) — Swiper + parallax خفيف، متوافق مع CSP.
 * الموبايل: تمرير أسهل (threshold / longSwipesRatio)، تحديث بعد resize / visualViewport.
 */
(function () {
  'use strict';
  var inst = null;
  var resizeTimer = null;

  /** عرض ساعة (0–24) كنص عربي تقريبي للهيرو */
  function formatHeroHourAr(hour) {
    var n = Math.floor(Number(hour));
    if (!isFinite(n) || n < 0 || n > 24) return '';
    if (n === 0 || n === 24) return '12:00 منتصف الليل';
    if (n === 12) return '12:00 ظهراً';
    if (n > 12) return n - 12 + ':00 مساءً';
    return n + ':00 صباحاً';
  }

  /** يحدّث نص الدوام في الشريحة الثالثة ورابط «فتح في خرائط جوجل» من window.settings */
  function updateHomeHeroAsidePanels() {
    try {
      var s = typeof window.settings !== 'undefined' && window.settings ? window.settings : null;
      var el = document.getElementById('homeHeroAsideHours');
      if (el && s) {
        var o = s.openHour != null ? Number(s.openHour) : 15;
        var c = s.closeHour != null ? Number(s.closeHour) : 24;
        var a = formatHeroHourAr(o);
        var b = formatHeroHourAr(c);
        if (a && b) el.textContent = 'يومياً: من ' + a + ' — إلى ' + b;
      }
      var mapLink = document.querySelector('.home-hero-aside-map__link');
      if (mapLink && s && s.mapUrl) {
        var u = String(s.mapUrl).trim();
        if (u) mapLink.href = u;
      }
    } catch (e) {}
  }

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
      /* موبايل: ارتفاع حسب المحتوى (بدون فراغ كبير تحت الأزرار) */
      autoHeight: true,
      parallax: false,
      watchSlidesProgress: true,
      slidesPerView: 1,
      spaceBetween: 0,
      /* تمرير أسهل على اللمس (موبايل) */
      threshold: 6,
      longSwipesRatio: 0.32,
      breakpoints: {
        601: {
          speed: reduce ? 350 : 700,
          autoHeight: false,
          parallax: !reduce
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
            if (this.params.autoHeight && typeof this.updateAutoHeight === 'function') {
              var sw = this;
              setTimeout(function () {
                try {
                  sw.updateAutoHeight(0);
                } catch (e0) {}
              }, 80);
            }
          } catch (e) {}
        },
        resize: function () {
          try {
            this.update();
          } catch (e3) {}
        },
        slideChangeTransitionEnd: function () {
          if (this.params.autoHeight && typeof this.updateAutoHeight === 'function') {
            try {
              this.updateAutoHeight(200);
            } catch (e5) {}
          }
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
        updateHomeHeroAsidePanels();
      },
      { once: true }
    );
    updateHomeHeroAsidePanels();
    setTimeout(updateHomeHeroAsidePanels, 500);
    setTimeout(updateHomeHeroAsidePanels, 2200);
    return true;
  }

  if (!init()) {
    window.addEventListener('load', function () {
      if (!init()) setTimeout(init, 200);
    });
  }
})();
