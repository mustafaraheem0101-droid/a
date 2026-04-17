/**
 * Updates page title and #page-title from the ?slug= query parameter.
 * Add: <script src="assets/js/slug-page-title.js" defer></script>
 * Requires: <h1 id="page-title"></h1> (or any element with id="page-title")
 */
(function () {
  'use strict';

  var DEFAULT_SLUG = 'all';

  /** Slug (URL segment) → display title */
  var SLUG_TO_TITLE = {
    all: 'جميع المنتجات',
    medicine: 'الأدوية',
    drugs: 'الأدوية',
    vitamin: 'الفيتامينات',
    vitamins: 'الفيتامينات',
    beauty: 'التجميل والعناية',
    cosmetics: 'التجميل والعناية',
    baby: 'منتجات الأطفال',
    kids: 'منتجات الأطفال',
    medical: 'المستلزمات الطبية',
    haircare: 'العناية بالشعر',
    oral_care: 'العناية بالفم والأسنان',
    oralcare: 'العناية بالفم والأسنان'
  };

  function getSlugFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get('slug');
      if (!raw) return null;
      var decoded = decodeURIComponent(raw.trim());
      return decoded || null;
    } catch (e) {
      return null;
    }
  }

  function resolveTitle(slug) {
    if (!slug || !SLUG_TO_TITLE.hasOwnProperty(slug)) {
      return SLUG_TO_TITLE[DEFAULT_SLUG];
    }
    return SLUG_TO_TITLE[slug];
  }

  function applyPageTitle(displayTitle, siteName) {
    siteName = siteName || 'المتجر';
    document.title = displayTitle + ' — ' + siteName;

    var el = document.getElementById('page-title');
    if (el) {
      el.innerText = displayTitle;
    }
  }

  var slug = getSlugFromUrl();
  var title = resolveTitle(slug);

  applyPageTitle(title);

  /** Optional: expose for tests or other scripts */
  window.slugPageTitle = {
    getSlug: function () { return slug; },
    getResolvedTitle: function () { return title; },
    SLUG_TO_TITLE: SLUG_TO_TITLE,
    DEFAULT_SLUG: DEFAULT_SLUG
  };
})();
