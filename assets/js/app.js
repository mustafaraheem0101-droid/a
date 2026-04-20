/**
 * app.js — تهيئة مشتركة + تفويض أحداث على document
 * الترتيب: utils.js → api.js → admin.js → app.js (لوحة التحكم: showPage هنا)
 *
 * • النقر ذو data-action: مستمع click واحد على document.
 * • لا fetch هنا — الطلبات عبر دوال api.js (مثل adminToggleProduct).
 * • ردود المستخدم: showToast (بدون alert حاجب) متوافق مع بقية المشروع.
 */
'use strict';

(function () {
  const doc = document;
  const win = window;

  const PAGE = (function () {
    const p = location.pathname.split('/').pop().replace(/\?.*$/, '') || 'index.html';
    const pl = String(p).toLowerCase();
    if (p === '' || pl === 'index.html') return 'home';
    if (pl === 'qr-discount.html') return 'qr-discount';
    if (pl === 'product.html') return 'product';
    if (pl === 'category.html') return 'category';
    if (pl === 'categories.html') return 'categories';
    if (pl === 'subcategory.html') return 'subcategory';
    if (p === 'control-panel.html' || p === 'control-panel.php') return 'admin';
    if (p === 'login.html' || p === 'login.php') return 'login';
    return 'other';
  })();

  /**
   * حالة الواجهة — القراءة من المصدر الواحد (window.prods / cart / settings / _adminState).
   * لوحة الإدارة: صفحات مثل AdminApp.productsPage ترسم داخل الوحدات بعد تحديث المتجر.
   */
  const state = {
    page: PAGE,
    get products() {
      return Array.isArray(win.prods) ? win.prods : [];
    },
    get cart() {
      return Array.isArray(win.cart) ? win.cart : [];
    },
    get settings() {
      return win.settings && typeof win.settings === 'object' ? win.settings : {};
    },
    get admin() {
      return win._adminState && typeof win._adminState === 'object' ? win._adminState : null;
    }
  };
  win.pharmaState = state;

  function notifySuccess(msg) {
    if (typeof showToast === 'function') showToast(msg || 'تم');
  }

  function notifyError(msg) {
    if (typeof showToast === 'function') showToast(msg || 'حدث خطأ', 'error');
  }

  let _cartShellCache = null;
  function getCartShellEls() {
    if (!_cartShellCache) {
      _cartShellCache = {
        cs: doc.getElementById('cs'),
        co: doc.getElementById('co')
      };
    }
    return _cartShellCache;
  }

  function safeCall(fn) {
    if (typeof fn !== 'function') return undefined;
    try {
      return fn();
    } catch (err) {
      if (typeof pharmaLogError === 'function') pharmaLogError('[app]', err);
      notifyError('حدث خطأ غير متوقع');
    }
  }

  function finishMaybeAsync(result, onError) {
    if (result && typeof result.then === 'function') {
      return result.catch(function (err) {
        if (typeof pharmaLogError === 'function') pharmaLogError('[app-async]', err);
        if (typeof onError === 'function') onError(err);
        else notifyError('تعذر إتمام العملية');
      });
    }
    return result;
  }

  /** showLoader + إخفاء مضمون في finally */
  function withGlobalLoader(promise) {
    if (!promise || typeof promise.then !== 'function') return promise;
    if (typeof showLoader === 'function') showLoader();
    return promise.finally(function () {
      if (typeof hideLoader === 'function') hideLoader();
    });
  }

  function eventTargetElement(e) {
    const t = e.target;
    if (t && t.nodeType === 1) return t;
    return t && t.parentElement ? t.parentElement : null;
  }

  function ctxFromActionEl(e, el) {
    return {
      e: e,
      el: el,
      id: el.dataset.id,
      idx: el.dataset.index !== undefined ? parseInt(el.dataset.index, 10) : undefined,
      active: el.dataset.active,
      action: el.dataset.action
    };
  }

  const CLICK_ACTIONS = {
    'toggle-cart': function () {
      if (typeof toggleCart === 'function') toggleCart();
    },
    'empty-go-back': function () {
      if (win.history.length > 1) win.history.back();
      else win.location.href = '/';
    },
    'close-cart': function () {
      const shell = getCartShellEls();
      if (shell.cs) shell.cs.classList.remove('open');
      if (shell.co) shell.co.classList.remove('open');
      doc.body.style.overflow = '';
    },
    'add-to-cart': function (c) {
      if (typeof addToCart !== 'function') return;
      const fb = {};
      if (c.el.dataset && c.el.dataset.pname) fb.name = c.el.dataset.pname;
      if (c.el.dataset && c.el.dataset.pprice !== undefined && c.el.dataset.pprice !== '') {
        fb.price = c.el.dataset.pprice;
      }
      if (c.el.dataset && c.el.dataset.pslug) fb.slug = c.el.dataset.pslug;
      addToCart(c.id, Object.keys(fb).length ? fb : undefined);
    },
    'remove-from-cart': function (c) {
      if (typeof removeFromCart === 'function') removeFromCart(c.id);
    },
    'qty-plus': function (c) {
      if (typeof changeQty === 'function') changeQty(c.id, 1);
    },
    'qty-minus': function (c) {
      if (typeof changeQty === 'function') changeQty(c.id, -1);
    },
    'like': function (c) {
      if (typeof toggleLike === 'function') toggleLike(c.id, c.el);
    },
    'search': function () {
      if (typeof doSearch === 'function') doSearch();
    },
    'pager': function (c) {
      if (typeof goPage !== 'function') return;
      finishMaybeAsync(goPage(Number(c.el.dataset.page)));
    },
    'send-wa': function (c) {
      if (typeof sendWA === 'function' && (c.el.id === 'moSendBtn' || c.el.closest('#mo'))) {
        finishMaybeAsync(sendWA());
      } else {
        const msg = c.el.dataset.msg || '';
        win.open(buildWaUrl(msg), '_blank', 'noopener,noreferrer');
      }
    },
    'open-modal': function () {
      if (typeof win.openModal !== 'function') return;
      const c = win.cart;
      if (!Array.isArray(c) || !c.length) {
        if (typeof showToast === 'function') showToast('السلة فارغة — أضف منتجات أولاً', 'info');
        return;
      }
      win.openModal();
    },
    'close-modal': function () {
      if (typeof closeModal === 'function') closeModal();
    },
    'edit-maincat': function (c) {
      if (typeof openMainCatModal === 'function') openMainCatModal(c.id);
    },
    'view-maincat-prods': function (c) {
      if (typeof bulkViewMainCategoryProducts === 'function') bulkViewMainCategoryProducts(c.id);
    },
    'delete-maincat': function (c) {
      if (typeof deleteMainCat === 'function') deleteMainCat(c.id);
    },
    'view-order': function (c) {
      if (typeof openOrderModal === 'function') openOrderModal(c.id);
    },
    'delete-order': function (c) {
      if (typeof confirmDeleteOrder === 'function') confirmDeleteOrder(c.id);
    },
    'edit-review': function (c) {
      if (typeof openReviewModal === 'function') openReviewModal(c.idx);
    },
    'toggle-review': function (c) {
      if (typeof toggleReviewApproval !== 'function') return;
      finishMaybeAsync(withGlobalLoader(toggleReviewApproval(c.idx)));
    },
    'delete-review': function (c) {
      if (typeof deleteReview !== 'function') return;
      finishMaybeAsync(withGlobalLoader(deleteReview(c.idx)));
    },
    'remove-hero-slide': function (c) {
      if (typeof removeHeroSlide === 'function') removeHeroSlide(c.idx);
    },
    'remove-cat-slide': function (c) {
      if (typeof removeCatSlide === 'function') removeCatSlide(c.idx);
    },
    'hero-move-up': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.moveUp(c.idx);
    },
    'hero-move-down': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.moveDown(c.idx);
    },
    'hero-edit': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.edit(c.idx);
    },
    'hero-toggle': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.toggleActive(c.idx);
    },
    'hero-remove': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.remove(c.idx);
    },
    'hero-save-edit': function (c) {
      if (win.HeroSliderAdmin) HeroSliderAdmin.saveEdit(c.idx);
    },
    'close-hero-edit-modal': function () {
      const hem = doc.getElementById('heroSlideEditModal');
      if (hem) hem.remove();
    },
    'remove-cart': function (c) {
      if (typeof removeFromCart === 'function') removeFromCart(c.id);
    },
    'open-img-modal': function (c) {
      const src = c.el.dataset.src;
      if (src && typeof openImgModal === 'function') openImgModal(src);
    },
    'close-img-modal': function () {
      if (typeof closeImgModal === 'function') closeImgModal();
    },
    'add-cart-product': function (c) {
      if (typeof addCart === 'function') addCart(c.id);
    },
    'switch-tab': function (c) {
      if (typeof switchTab === 'function') switchTab(c.el.dataset.tab, c.el);
    },
    'switch-gallery-thumb': function (c) {
      const idx = parseInt(c.el.dataset.galleryIdx, 10);
      const urls = win.__productGalleryUrls || [];
      const main = doc.getElementById('prodMainImg');
      const wrap = doc.querySelector('.prod-gallery-main .img-zoom-wrap');
      const fullBtn = doc.querySelector('.prod-zoom-full');
      if (!main || !urls[idx]) return;
      main.src = urls[idx];
      if (wrap) wrap.dataset.src = urls[idx];
      if (fullBtn) fullBtn.dataset.src = urls[idx];
      doc.querySelectorAll('.prod-gallery-thumb').forEach(function (b, i) {
        b.classList.toggle('is-active', i === idx);
      });
    },
    'wa-open-product': function (c) {
      if (typeof win.trackWaClick === 'function') win.trackWaClick(c.id);
    },
    'wa-order-product': function (c) {
      const list = win.prods || [];
      let p = list.find(function (x) { return String(x.id) === String(c.id); });
      if (!p && c.el.dataset && c.el.dataset.pname) {
        p = {
          id: c.id,
          name: c.el.dataset.pname,
          price: c.el.dataset.pprice,
          slug: c.el.dataset.pslug || undefined
        };
      }
      if (!p || typeof win.buildWaUrl !== 'function') return;
      if (typeof win.buildProductWaOrderText !== 'function') return;
      if (c.el.dataset && c.el.dataset.pprice !== undefined && c.el.dataset.pprice !== '') {
        p = Object.assign({}, p, { price: c.el.dataset.pprice });
      }
      if (typeof win.trackWaClick === 'function') win.trackWaClick(c.id);
      win.open(win.buildWaUrl(win.buildProductWaOrderText(p)), '_blank', 'noopener,noreferrer');
    },
    'set-star': function (c) {
      if (typeof setReviewStar === 'function') setReviewStar(parseInt(c.el.dataset.val, 10));
    },
    'submit-review': function (c) {
      if (typeof submitReview !== 'function') return;
      finishMaybeAsync(withGlobalLoader(submitReview(c.el.dataset.product)));
    },
    'nav-product': function (c) {
      location.href = 'product.html?id=' + c.id;
    },
    'nav-cat': function (c) {
      const slug = c.el.dataset.slug;
      if (slug) location.href = 'category.html?slug=' + slug;
    },
    'category-filter-reset': function () {
      if (typeof categoryPageResetFilters === 'function') {
        finishMaybeAsync(categoryPageResetFilters());
      }
    },
    'apply-name-suggest': function (c) {
      const nameEl = doc.getElementById('f-name');
      const suggestEl = doc.getElementById('product-name-suggest');
      if (nameEl) nameEl.value = c.el.dataset.name || '';
      if (suggestEl) suggestEl.innerHTML = '';
    },
    'pager-admin': function (c) {
      if (typeof showPage === 'function') showPage(c.el.dataset.page);
    }
  };

  function handleDelegatedDataActionClick(e) {
    const el = eventTargetElement(e);
    if (!el || typeof el.closest !== 'function') return false;

    const target = el.closest('[data-action]');
    if (!target) return false;

    const action = target.dataset.action;
    if (!action) return true;

    const fn = CLICK_ACTIONS[action];
    if (fn) safeCall(function () { fn(ctxFromActionEl(e, target)); });
    return true;
  }

  function handleLegacyChromeClick(e, root) {
    if (root.closest('#co')) {
      if (typeof toggleCart === 'function') toggleCart();
      return;
    }
    if (root.closest('#toTopBtn')) {
      win.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const waLink = root.closest('[data-wa-link]');
    if (waLink) {
      e.preventDefault();
      const resolved = String(waLink.href || '');
      const hrefOk = /^https:\/\/wa\.me\//i.test(resolved);
      const waMsg = waLink.dataset && waLink.dataset.waText != null ? String(waLink.dataset.waText) : '';
      const bWa = typeof win.buildWaUrl === 'function' ? win.buildWaUrl.bind(win) : null;
      const url = hrefOk ? resolved : (bWa ? bWa(waMsg) : '#');
      win.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
  }

  function onDocumentClick(e) {
    if (handleDelegatedDataActionClick(e)) return;

    const root = eventTargetElement(e);
    if (!root || typeof root.closest !== 'function') return;

    handleLegacyChromeClick(e, root);
  }

  const CHANGE_ACTIONS = {
    /* toggle-maincat-select: داخل mainCategoriesPage */
    'toggle-hero-slide': function (t) {
      if (typeof toggleHeroSlide === 'function') toggleHeroSlide(parseInt(t.dataset.index, 10), t.checked);
    },
    'toggle-cat-slide': function (t) {
      if (typeof toggleCatSlide === 'function') toggleCatSlide(parseInt(t.dataset.index, 10), t.checked);
    },
    'update-order-status': function (t) {
      if (typeof updateOrderStatusUI !== 'function') return;
      finishMaybeAsync(withGlobalLoader(updateOrderStatusUI(t.dataset.id, t.value)));
    }
  };

  function onDocumentChange(e) {
    const t = e.target;
    const action = t.dataset && t.dataset.action;
    if (!action) return;
    const fn = CHANGE_ACTIONS[action];
    if (fn) safeCall(function () { fn(t); });
  }

  function injectGlobalLoader() {
    if (doc.getElementById('_globalLoader')) return;
    if (typeof ensurePharmaCspJsShimCss === 'function') {
      ensurePharmaCspJsShimCss();
    }
    const el = doc.createElement('div');
    el.id = '_globalLoader';
    el.setAttribute('aria-label', 'جارٍ التحميل');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="gl-spin" aria-hidden="true"></div>';
    doc.body.appendChild(el);
  }

  function initFooterAnimate() {
    const ft = doc.getElementById('footer');
    if (!ft || !ft.classList.contains('p-footer--animate')) return;
    if (!('IntersectionObserver' in win)) {
      ft.classList.add('p-footer--visible');
      return;
    }
    const obs = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        ft.classList.add('p-footer--visible');
        obs.disconnect();
        break;
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -32px 0px' });
    obs.observe(ft);
  }

  function initScrollReveal() {
    if (!('IntersectionObserver' in win)) {
      const nodes = doc.querySelectorAll('.reveal');
      for (let i = 0; i < nodes.length; i++) nodes[i].classList.add('in');
      const cards = doc.querySelectorAll('.reveal-card');
      for (let c = 0; c < cards.length; c++) cards[c].classList.add('is-visible');
      const secs = doc.querySelectorAll('.p-sec-fade');
      for (let s = 0; s < secs.length; s++) secs[s].classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver(function (entries) {
      for (let i = 0; i < entries.length; i++) {
        const x = entries[i];
        if (!x.isIntersecting) continue;
        const t = x.target;
        if (t.classList.contains('reveal')) t.classList.add('in');
        if (t.classList.contains('reveal-card')) t.classList.add('is-visible');
        if (t.classList.contains('p-sec-fade')) t.classList.add('is-visible');
        obs.unobserve(t);
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -56px 0px' });
    const revealNodes = doc.querySelectorAll('.reveal:not(.in)');
    for (let j = 0; j < revealNodes.length; j++) obs.observe(revealNodes[j]);
    const cardNodes = doc.querySelectorAll('.reveal-card:not(.is-visible)');
    for (let k = 0; k < cardNodes.length; k++) obs.observe(cardNodes[k]);
    const fadeSecs = doc.querySelectorAll('.p-sec-fade:not(.is-visible)');
    for (let f = 0; f < fadeSecs.length; f++) obs.observe(fadeSecs[f]);
  }

  /** تمرير viewport — مستمع واحد على window (ليس على زر محدد) */
  function initBackToTop() {
    const btn = doc.getElementById('toTopBtn');
    if (!btn) return;
    const handleScroll = typeof debounce === 'function'
      ? debounce(function () {
          const on = win.scrollY > 400;
          btn.style.opacity = on ? '1' : '0';
          btn.style.pointerEvents = on ? 'auto' : 'none';
        }, 80)
      : function () {
          const on = win.scrollY > 400;
          btn.style.opacity = on ? '1' : '0';
          btn.style.pointerEvents = on ? 'auto' : 'none';
        };
    win.addEventListener('scroll', handleScroll, { passive: true });
  }

  function bindDocumentDelegates() {
    doc.addEventListener('click', onDocumentClick);
    doc.addEventListener('change', onDocumentChange);
    /* البحث: مستمعات موحّدة في assets/js/shop-search.js (لا تكرار هنا) */
  }

  function initCommon() {
    injectGlobalLoader();
    bindDocumentDelegates();
    initBackToTop();
    initFooterAnimate();
    if (typeof updateCartBadge === 'function') updateCartBadge();
    /* شريط العد العائم (initOfferCountdownUi) مُعطّل: الرئيسية والأقسام بدون شريط عرض؛ qr-discount.html يعرض العد داخل الهيرو (#qrCountdown). */
    if (PAGE === 'home' && typeof win.initIndexQrWelcomeCelebration === 'function') {
      win.initIndexQrWelcomeCelebration();
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  function run() {
    initCommon();

    if (PAGE === 'home' && typeof buildNav === 'function') {
      buildNav([]);
    }
    setTimeout(function () {
      if (PAGE === 'home' && typeof initHome === 'function') initHome();
      if (PAGE === 'product' && typeof initProduct === 'function') initProduct();
      if (PAGE === 'category' && typeof initCategory === 'function') initCategory();
      if (PAGE === 'categories' && typeof initCategories === 'function') initCategories();
      if (PAGE === 'subcategory' && typeof initSubcategory === 'function') initSubcategory();
    }, 0);

    win.addEventListener('load', initScrollReveal);
  }

  win.APP_PAGE = PAGE;
  win.initScrollReveal = initScrollReveal;

  /**
   * لوحة التحكم — SPA: التبديل عبر class .page.act (لا تعتمد على style.display)
   * يجب تحميل admin.js قبل هذا الملف حتى تكون دوال الرسم و fetch*StateThenRender جاهزة.
   */
  if (PAGE === 'admin' && !win.__ADMIN_ROUTER__) {
    (function adminSpaRouter() {
      var titles = {
        dashboard: '📊 لوحة التحكم',
        products: '📦 المنتجات',
        add: '➕ إضافة منتج',
        maincategories: '📁 الأقسام الرئيسية',
        orders: '🛒 الطلبات',
        reviews: '⭐ التقييمات',
        homepage: '🖼️ الصفحة الرئيسية',
        settings: '⚙️ الإعدادات',
        backup: '💾 النسخ الاحتياطي',
        reports: '📈 التقارير',
        activitylog: '🧾 سجل النشاط'
      };

      function cpLog(phase, pageId, detail) {
        if (typeof console !== 'undefined' && console.log) {
          console.log('[CP/' + phase + '] page=' + pageId + (detail ? ' | ' + detail : ''));
        }
      }

      function runLoader(name) {
        var w = win;
        cpLog('load', name, 'start');
        try {
          if (name === 'dashboard' && typeof w.renderDashboard === 'function') {
            w.renderDashboard();
          } else if (name === 'products' && w.AdminApp && w.AdminApp.productsPage && typeof w.AdminApp.productsPage.activate === 'function') {
            w.AdminApp.productsPage.activate();
          } else if (name === 'maincategories' && typeof w.fetchCategoriesStateThenRender === 'function') {
            w.fetchCategoriesStateThenRender();
          } else if (name === 'orders' && typeof w.fetchOrdersStateThenRender === 'function') {
            w.fetchOrdersStateThenRender();
          } else if (name === 'reviews' && typeof w.loadAndRenderReviews === 'function') {
            w.loadAndRenderReviews();
          } else if (name === 'homepage' && typeof w.renderHomepageSettings === 'function') {
            w.renderHomepageSettings();
          } else if (name === 'settings' && typeof w.renderSettingsForm === 'function') {
            w.renderSettingsForm();
          } else if (name === 'reports' && typeof w.renderReports === 'function') {
            w.renderReports();
          } else {
            cpLog('load', name, 'no handler (static or empty page)');
          }
        } catch (err) {
          if (typeof pharmaLogError === 'function') pharmaLogError('[CP-load]', err);
          else if (typeof console !== 'undefined' && console.error) console.error('[CP-load]', err);
        }
        cpLog('load', name, 'dispatched');
      }

      function showPage(name) {
        if (!name) return;
        var pageId = String(name);
        cpLog('nav', pageId, 'switch visible section');

        var pages = doc.querySelectorAll('.content .page');
        for (var i = 0; i < pages.length; i++) {
          pages[i].classList.remove('act');
          pages[i].style.display = '';
        }

        var pageEl = doc.getElementById('page-' + pageId);
        if (pageEl) {
          pageEl.classList.add('act');
        } else {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[CP] missing #page-' + pageId);
          }
        }

        var titleEl = doc.getElementById('page-title');
        if (titleEl) {
          titleEl.textContent = titles[pageId] || pageId;
        }

        if (win._adminState && typeof win._adminState === 'object') {
          win._adminState.currentPage = pageId;
        }

        var sbItems = doc.querySelectorAll('.sb-item');
        for (var j = 0; j < sbItems.length; j++) {
          sbItems[j].classList.remove('act');
        }
        var activeItem = doc.querySelector('.sb-item[data-page="' + pageId + '"]');
        if (activeItem) {
          activeItem.classList.add('act');
        }

        runLoader(pageId);

        if (typeof win.closeSidebar === 'function') {
          win.closeSidebar();
        }
        win.scrollTo({ top: 0, behavior: 'smooth' });
      }

      win.showPage = showPage;
    })();
  }
})();
