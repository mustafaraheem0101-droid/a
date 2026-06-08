/**
 * تهيئة سلايدر العروض (Swiper) — ملف خارجي لتوافق CSP (بدون سكربت مضمّن في HTML).
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
  var promoSwiperInstance = null;
  var promoRefreshTimer = null;
  function schedulePromoRefresh() {
    if (!promoSwiperInstance) return;
    clearTimeout(promoRefreshTimer);
    promoRefreshTimer = setTimeout(function () {
      promoSwiperInstance.update();
      try {
        if (promoSwiperInstance.autoplay && typeof promoSwiperInstance.autoplay.start === 'function') {
          promoSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    }, 80);
  }
  function setupPromoImages() {
    document.querySelectorAll('.promo-slide-img').forEach(function (img) {
      var primary = img.getAttribute('src');
      if (primary) primary = resolveSlideSrc(primary);
      var fb = img.getAttribute('data-fallback');
      if (fb) fb = resolveSlideSrc(fb);
      img.addEventListener('load', schedulePromoRefresh, { once: true });
      img.addEventListener(
        'error',
        function onPromoErr() {
          img.removeEventListener('error', onPromoErr);
          if (fb && img.currentSrc !== fb) {
            img.src = fb;
            img.removeAttribute('data-fallback');
            img.addEventListener('load', schedulePromoRefresh, { once: true });
          }
        },
        { once: true }
      );
      if (primary) img.src = primary;
    });
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function buildPromoSlideHtml(sl, index) {
    var src = resolveSlideSrc((sl.img_desktop || sl.img_mobile || '').trim());
    if (!src) return '';
    var alt = escAttr(sl.alt_text || sl.title || 'عرض ترويجي');
    var link = (sl.link_url || '').trim();
    var eager = index === 0 ? 'eager' : 'lazy';
    var priority = index === 0 ? ' fetchpriority="high"' : '';
    var img =
      '<img src="' + escAttr(src) + '" alt="' + alt + '" class="promo-slide-img" width="1600" height="500" decoding="async" loading="' + eager + '"' + priority + '>';
    var inner = link
      ? '<a href="' + escAttr(link) + '" class="promo-slide-link" aria-label="' + alt + '">' + img + '</a>'
      : '<div class="promo-slide-link">' + img + '</div>';
    return '<div class="swiper-slide">' + inner + '</div>';
  }

  function loadPromoSlidersFromDB() {
    return fetch('/api-sliders.php', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return false;
        var root = document.querySelector('.promo-swiper');
        if (!root) return false;
        var wrapper = root.querySelector('.swiper-wrapper');
        if (!wrapper) return false;
        wrapper.innerHTML = rows.map(buildPromoSlideHtml).join('');
        return true;
      })
      .catch(function () { return false; });
  }

  function initHomePromoSwiper() {
    if (promoSwiperInstance) return true;
    var root = document.querySelector('.promo-swiper');
    if (!root || typeof Swiper === 'undefined') return false;
    var pagEl = root.querySelector('.promo-swiper-pagination');
    var nextEl = root.querySelector('.promo-swiper-next');
    var prevEl = root.querySelector('.promo-swiper-prev');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    var slideSpeed = reduceMotion ? 200 : narrow ? 660 : 520;

    function pinPromoPaginationCenter() {
      var el = root.querySelector('.promo-swiper-pagination');
      if (!el) return;
      el.style.setProperty('left', '50%', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('transform', 'translateX(-50%)', 'important');
      el.style.setProperty('width', 'max-content', 'important');
    }

    promoSwiperInstance = new Swiper(root, {
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
      autoplay: {
        delay: 2000,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
        waitForTransition: true
      },
      pagination: {
        el: pagEl || '.promo-swiper-pagination',
        clickable: true,
        dynamicBullets: false
      },
      navigation: {
        nextEl: nextEl || '.promo-swiper-next',
        prevEl: prevEl || '.promo-swiper-prev'
      },
      keyboard: { enabled: true, onlyInViewport: true },
      on: {
        init: function () {
          var inst = this;
          pinPromoPaginationCenter();
          requestAnimationFrame(function () {
            pinPromoPaginationCenter();
            inst.update();
            try {
              if (inst.autoplay && typeof inst.autoplay.start === 'function') inst.autoplay.start();
            } catch (e) {}
            requestAnimationFrame(pinPromoPaginationCenter);
          });
        },
        slideChangeTransitionEnd: pinPromoPaginationCenter,
        resize: pinPromoPaginationCenter,
        paginationUpdate: pinPromoPaginationCenter
      }
    });

    window.addEventListener('load', function () {
      if (!promoSwiperInstance) return;
      promoSwiperInstance.update();
      pinPromoPaginationCenter();
      try {
        if (promoSwiperInstance.autoplay && typeof promoSwiperInstance.autoplay.start === 'function') {
          promoSwiperInstance.autoplay.start();
        }
      } catch (e) {}
    });
    return true;
  }

  function bootPromo() {
    setupPromoImages();
    if (!initHomePromoSwiper()) {
      window.addEventListener('load', function () {
        if (!initHomePromoSwiper()) setTimeout(initHomePromoSwiper, 250);
      });
    }
  }

  loadPromoSlidersFromDB().then(bootPromo);
})();
