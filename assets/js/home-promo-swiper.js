/**
 * تهيئة سلايدرات العروض (Swiper) — ملف خارجي لتوافق CSP (بدون سكربت مضمّن في HTML).
 * يدعم سلايدرين فوق بعض: صور لوحة التحكم تُوزَّع بالتساوي (النصف الأول → السلايدر الأول، الباقي → الثاني).
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
  var promoSwiperInstances = [];
  var promoRefreshTimer = null;
  function schedulePromoRefresh() {
    if (!promoSwiperInstances.length) return;
    clearTimeout(promoRefreshTimer);
    promoRefreshTimer = setTimeout(function () {
      promoSwiperInstances.forEach(function (inst) {
        if (!inst) return;
        inst.update();
        try {
          if (inst.autoplay && typeof inst.autoplay.start === 'function') {
            inst.autoplay.start();
          }
        } catch (e) {}
      });
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
        var roots = document.querySelectorAll('.promo-swiper');
        if (!roots.length) return false;
        // وزّع الصور بالتساوي: النصف الأول للسلايدر الأول، الباقي للثاني
        var half = Math.ceil(rows.length / 2);
        var groups = roots.length > 1 ? [rows.slice(0, half), rows.slice(half)] : [rows];
        roots.forEach(function (root, i) {
          var wrapper = root.querySelector('.swiper-wrapper');
          if (!wrapper) return;
          var group = groups[i] || [];
          var section = root.closest('.promo-swiper-section');
          if (!group.length) {
            // لا صور لهذا السلايدر — أخفِ قسمه
            if (section) section.style.display = 'none';
            return;
          }
          if (section) section.style.display = '';
          wrapper.innerHTML = group.map(buildPromoSlideHtml).join('');
        });
        return true;
      })
      .catch(function () { return false; });
  }

  function initOnePromoSwiper(root) {
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

    var inst = new Swiper(root, {
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
        el: pagEl,
        clickable: true,
        dynamicBullets: false
      },
      navigation: {
        nextEl: nextEl,
        prevEl: prevEl
      },
      keyboard: { enabled: true, onlyInViewport: true },
      on: {
        init: function () {
          var self = this;
          pinPromoPaginationCenter();
          requestAnimationFrame(function () {
            pinPromoPaginationCenter();
            self.update();
            try {
              if (self.autoplay && typeof self.autoplay.start === 'function') self.autoplay.start();
            } catch (e) {}
            requestAnimationFrame(pinPromoPaginationCenter);
          });
        },
        slideChangeTransitionEnd: pinPromoPaginationCenter,
        resize: pinPromoPaginationCenter,
        paginationUpdate: pinPromoPaginationCenter
      }
    });
    return inst;
  }

  function initHomePromoSwiper() {
    if (promoSwiperInstances.length) return true;
    if (typeof Swiper === 'undefined') return false;
    var roots = document.querySelectorAll('.promo-swiper');
    if (!roots.length) return false;
    roots.forEach(function (root) {
      var wrapper = root.querySelector('.swiper-wrapper');
      if (!wrapper || !wrapper.children.length) return;
      promoSwiperInstances.push(initOnePromoSwiper(root));
    });
    if (!promoSwiperInstances.length) return false;

    window.addEventListener('load', function () {
      promoSwiperInstances.forEach(function (inst) {
        if (!inst) return;
        inst.update();
        try {
          if (inst.autoplay && typeof inst.autoplay.start === 'function') inst.autoplay.start();
        } catch (e) {}
      });
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
