/**
 * شبكة العروض الترويجية — 3 أعلى + 3 تحت (بدون سلايدر دوّار)
 * المصدر: api-sliders.php ثم احتياطي الصور الثابتة في assets/img/promo-slider/
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

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var STATIC_FALLBACK = [
    { link_url: 'category.html?slug=kids', img_desktop: 'assets/img/promo-slider/slide-johnsons.png', alt_text: 'جونسون بيبي أويل' },
    { link_url: 'category.html?slug=kids', img_desktop: 'assets/img/promo-slider/slide-02.png', alt_text: 'عرض ترويجي' },
    { link_url: 'categories.html#prod-sec', img_desktop: 'assets/img/promo-slider/slide-03.png', alt_text: 'عرض ترويجي' },
    { link_url: 'category.html?slug=cosmetics', img_desktop: 'assets/img/promo-slider/slide-04.png', alt_text: 'عرض ترويجي' },
    { link_url: 'categories.html', img_desktop: 'assets/img/promo-slider/slide-05.png', alt_text: 'عرض ترويجي' },
    { link_url: 'category.html?slug=kids', img_desktop: 'assets/img/promo-slider/slide-06.png', alt_text: 'عرض ترويجي' }
  ];

  function buildPromoGridItemHtml(sl, index) {
    var src = resolveSlideSrc((sl.img_desktop || sl.img_mobile || '').trim());
    if (!src) return '';
    var alt = escAttr(sl.alt_text || sl.title || 'عرض ترويجي');
    var link = (sl.link_url || '').trim();
    var eager = index < 3 ? 'eager' : 'lazy';
    var priority = index === 0 ? ' fetchpriority="high"' : '';
    var img =
      '<img src="' + escAttr(src) + '" alt="' + alt + '" class="promo-slide-img" width="1600" height="500" decoding="async" loading="' + eager + '"' + priority + '>';
    var inner = link
      ? '<a href="' + escAttr(link) + '" class="promo-slide-link" aria-label="' + alt + '">' + img + '</a>'
      : '<div class="promo-slide-link">' + img + '</div>';
    return '<div class="promo-grid__item">' + inner + '</div>';
  }

  function renderPromoGrid(slides) {
    var grid = document.getElementById('promoGrid');
    if (!grid || !Array.isArray(slides) || !slides.length) return;
    grid.innerHTML = slides.map(buildPromoGridItemHtml).join('');
    grid.classList.add('promo-grid--ready');
  }

  function loadPromoSliders() {
    return fetch('/api-sliders.php', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length) {
          renderPromoGrid(rows);
          return;
        }
        renderPromoGrid(STATIC_FALLBACK);
      })
      .catch(function () {
        renderPromoGrid(STATIC_FALLBACK);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPromoSliders);
  } else {
    loadPromoSliders();
  }
})();
