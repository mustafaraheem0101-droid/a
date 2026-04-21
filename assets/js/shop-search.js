/**
 * بحث موحّد للمتجر — api.php?action=search (MySQL عبر pharma_db_*)
 * • اقتراحات فورية من أول حرف: عرض محلي من window.prods ثم تحديث من الخادم
 * • صفحة القسم: دمج مع categoryState.baseList عبر categoryRunUnifiedProductFilter
 */
(function () {
  'use strict';

  var INPUT_SEL = '#srchInput, .p-srch-box';
  var SUGGEST_SEL = '#srchSuggest, .srch-suggest';
  var SUBMIT_SEL = '#main-search-btn, #search-btn-inline, .p-srch-btn, .srch-btn';
  var SUGGEST_LIMIT_LOCAL = 12;
  var SUGGEST_LIMIT_API = 12;
  /** يزيد مع كل طلب اقتراحات لرفض ردود قديمة بعد كتابة أحرف جديدة */
  var _suggestGen = 0;

  function getSuggestEl() {
    return document.querySelector(SUGGEST_SEL);
  }

  function isSearchInput(el) {
    return el && typeof el.matches === 'function' && el.matches(INPUT_SEL);
  }

  function esc(s) {
    if (typeof escHtml === 'function') return escHtml(s);
    return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n) {
    if (typeof fmt === 'function') return fmt(n);
    return String(n);
  }

  function moneyWithShelfPromo(n, product) {
    var list = Number(n) || 0;
    if (typeof getShelfPromoDiscountPercent !== 'function' || typeof applyShelfPromoToPrice !== 'function') {
      return money(n);
    }
    var uiOn = typeof isOfferQrShelfPromoUiActive === 'function' ? isOfferQrShelfPromoUiActive() : false;
    var pct = uiOn ? getShelfPromoDiscountPercent() : 0;
    if (product && typeof isProductCategoryEligibleForQrShelfPromo === 'function' && !isProductCategoryEligibleForQrShelfPromo(product)) {
      pct = 0;
    }
    var fin = applyShelfPromoToPrice(list, pct);
    return money(pct > 0 && list > 0 ? fin : list);
  }

  /**
   * تطابق سريع على المخزن المحلي — يفضّل الأسماء التي تبدأ بالنص المكتوب (عربي/إنجليزي)
   */
  function filterProdsLocal(q, limit) {
    var list = typeof window.prods !== 'undefined' ? window.prods : [];
    if (!list.length || !q) return [];
    var qn = String(q).trim();
    if (!qn) return [];
    var ql = qn.toLowerCase();
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p.active === false) continue;
      var name = String(p.name || '');
      var desc = String(p.desc || '');
      var cat = String(p.cat || '');
      var nameLo = name.toLowerCase();
      var descLo = desc.toLowerCase();
      var catLo = cat.toLowerCase();
      var inName = name.indexOf(qn) !== -1 || nameLo.indexOf(ql) !== -1;
      var inDesc = descLo.indexOf(ql) !== -1;
      var inCat = catLo.indexOf(ql) !== -1;
      if (!inName && !inDesc && !inCat) continue;
      var starts =
        name.indexOf(qn) === 0 ||
        nameLo.indexOf(ql) === 0;
      scored.push({ p: p, starts: starts ? 0 : 1 });
    }
    scored.sort(function (a, b) {
      if (a.starts !== b.starts) return a.starts - b.starts;
      return 0;
    });
    var out = [];
    for (var j = 0; j < scored.length && out.length < limit; j++) {
      out.push(scored[j].p);
    }
    return out;
  }

  function mapApiSuggestion(s) {
    return { id: s.id, name: s.name, price: s.price, image: s.image, slug: s.slug, ico: '📦' };
  }

  function renderSuggestHtml(q, results) {
    if (!results.length) {
      return (
        '<div class="srch-no-res srch-no-res--rich">لا نتائج لـ "<strong>' +
        esc(q) +
        '</strong>"<br><a href="categories.html">تصفح الأقسام</a> أو جرّب حروفاً أخرى.</div>'
      );
    }
    return (
      '<div class="srch-list" role="listbox" aria-label="اقتراحات البحث">' +
      results
        .map(function (p) {
          var href =
            typeof productPageUrl === 'function'
              ? productPageUrl(p)
              : 'product.html?id=' + encodeURIComponent(String(p.id != null ? p.id : ''));
          var rawImg = p.image || p.img || '';
          var u = rawImg && typeof fixImgUrl === 'function' ? fixImgUrl(rawImg) : rawImg;
          var ok =
            u &&
            typeof u === 'string' &&
            (u.indexOf('http://') === 0 || u.indexOf('https://') === 0 || u.indexOf('/') === 0);
          // lazy-loading added (srch-thumb img)
          var imgPart = ok
            ? '<img src="' + esc(u) + '" alt="" class="img-cover srch-thumb" loading="lazy" decoding="async" draggable="false">'
            : '<span class="srch-ico-fallback">' + (p.ico || '📦') + '</span>';
          var label = 'فتح صفحة المنتج: ' + String(p.name || '');
          return (
            '<a href="' +
            esc(href) +
            '" class="srch-item" role="option" aria-label="' +
            esc(label) +
            '"><span class="srch-ico">' +
            imgPart +
            '</span><span class="srch-name">' +
            esc(p.name) +
            '</span><span class="srch-price">' +
            moneyWithShelfPromo(p.price, p) +
            '</span><span class="srch-go" aria-hidden="true"><span class="srch-go__txt">عرض</span><span class="srch-go__ico">›</span></span></a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function paintSuggestions(q, results) {
    var suggest = getSuggestEl();
    if (!suggest || typeof replaceChildrenFromHtml !== 'function') return;
    replaceChildrenFromHtml(suggest, renderSuggestHtml(q, results));
  }

  async function runSuggest(q) {
    q = (q || '').trim();
    var suggest = getSuggestEl();
    if (!q) {
      if (suggest && typeof replaceChildrenFromHtml === 'function') replaceChildrenFromHtml(suggest, '');
      return;
    }
    var myGen = ++_suggestGen;
    var local = filterProdsLocal(q, SUGGEST_LIMIT_LOCAL);

    if (myGen !== _suggestGen) return;
    if (local.length) {
      paintSuggestions(q, local);
    }

    if (typeof apiFetch === 'function') {
      try {
        var res = await apiFetch('search', { q: q, suggest: 1, limit: SUGGEST_LIMIT_API });
        if (myGen !== _suggestGen) return;
        if (apiIsSuccess(res) && res.data && res.data.suggestions && res.data.suggestions.length) {
          var apiRows = res.data.suggestions.map(mapApiSuggestion);
          paintSuggestions(q, apiRows);
          return;
        }
      } catch (e1) {
        /* fallback أدناه */
      }
    }

    if (myGen !== _suggestGen) return;
    if (local.length) {
      paintSuggestions(q, local);
    } else {
      paintSuggestions(q, []);
    }
  }

  function buildNavigateParams() {
    var input = document.querySelector(INPUT_SEL);
    var q = input && input.value ? input.value.trim() : '';
    if (!q) return null;
    var params = { q: q };
    var path = (location.pathname || '').split('/').pop() || '';
    if (/category\.html/i.test(path)) {
      var slug = new URLSearchParams(location.search).get('slug');
      if (slug && typeof window.resolveCategorySlugAlias === 'function') {
        slug = window.resolveCategorySlugAlias(slug) || slug;
      }
      if (slug) params.category = slug;
      if (typeof window.categoryReadFilterInputs === 'function') {
        var fp = window.categoryReadFilterInputs();
        if (fp.minP != null && !isNaN(fp.minP)) params.min_price = String(fp.minP);
        if (fp.maxP != null && !isNaN(fp.maxP)) params.max_price = String(fp.maxP);
        if (fp.typ) params.product_type = fp.typ;
      }
    }
    return params;
  }

  async function goToFirstProductMatch() {
    var params = buildNavigateParams();
    if (!params) return;
    if (typeof apiFetch === 'function') {
      try {
        var res = await apiFetch('search', params);
        if (apiIsSuccess(res) && res.data && res.data.products && res.data.products[0]) {
          var fp = res.data.products[0];
          var u = typeof productPageUrl === 'function' ? productPageUrl(fp) : 'product.html?id=' + encodeURIComponent(fp.id);
          location.href = u;
          return;
        }
      } catch (e2) {
        /* fallback */
      }
    }
    var q = params.q.toLowerCase();
    var list = typeof window.prods !== 'undefined' ? window.prods : [];
    if (!list.length) return;
    var first = null;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.name && p.name.toLowerCase().indexOf(q) !== -1) {
        first = p;
        break;
      }
    }
    if (first) {
      location.href =
        typeof productPageUrl === 'function' ? productPageUrl(first) : 'product.html?id=' + encodeURIComponent(first.id);
    }
  }

  /** أول حرف (أو حرفان): بدون تأخير؛ باقي النص: debounce أقصر */
  var dSuggest = typeof debounce === 'function'
    ? debounce(function (v) {
        runSuggest(v).catch(function () {});
      }, 55)
    : function (v) {
        runSuggest(v).catch(function () {});
      };

  var dCategoryUnified = typeof debounce === 'function'
    ? debounce(function () {
        if (typeof window.categoryRunUnifiedProductFilter === 'function') {
          window.categoryRunUnifiedProductFilter().catch(function () {});
        }
      }, 320)
    : function () {
        if (typeof window.categoryRunUnifiedProductFilter === 'function') {
          window.categoryRunUnifiedProductFilter().catch(function () {});
        }
      };

  function onDocInput(e) {
    if (!isSearchInput(e.target)) return;
    var raw = e.target.value;
    var t = raw.trim();
    if (!t) {
      runSuggest('').catch(function () {});
    } else if (t.length <= 2) {
      runSuggest(raw).catch(function () {});
    } else {
      dSuggest(raw);
    }
    dCategoryUnified();
  }

  function onDocFocusIn(e) {
    if (!isSearchInput(e.target)) return;
    if (e.target.value.trim()) runSuggest(e.target.value).catch(function () {});
  }

  function onDocKeydown(e) {
    if (!isSearchInput(e.target)) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    goToFirstProductMatch().catch(function () {});
  }

  function onDocClickCloseSuggest(e) {
    var box = document.querySelector(INPUT_SEL);
    var suggest = getSuggestEl();
    if (!suggest || typeof replaceChildrenFromHtml !== 'function') return;
    if (box && box.contains(e.target)) return;
    if (suggest.contains(e.target)) return;
    replaceChildrenFromHtml(suggest, '');
  }

  function bindSubmitButtons() {
    document.querySelectorAll(SUBMIT_SEL).forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        goToFirstProductMatch().catch(function () {});
      });
    });
  }

  function initShopSearch() {
    if (window.__pharmaShopSearchInited) return;
    window.__pharmaShopSearchInited = true;
    document.addEventListener('input', onDocInput, true);
    document.addEventListener('focusin', onDocFocusIn, true);
    document.addEventListener('keydown', onDocKeydown, true);
    document.addEventListener('click', onDocClickCloseSuggest);
    bindSubmitButtons();
  }

  window.doSearch = function () {
    goToFirstProductMatch().catch(function () {});
  };

  window.SHOP_HEADER_SEARCH_INPUT_SELECTOR = INPUT_SEL;
  window.SHOP_SEARCH_SUGGEST_SELECTOR = SUGGEST_SEL;
  window.SHOP_SEARCH_SUBMIT_SELECTOR = SUBMIT_SEL;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShopSearch);
  } else {
    initShopSearch();
  }
})();
