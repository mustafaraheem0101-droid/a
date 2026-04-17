/**
 * router.js — تنقّل لوحة التحكم مع mount / unmount لكل صفحة
 */
'use strict';

(function (global) {
  var PAGE_TITLES = {
    dashboard: '📊 لوحة التحكم',
    products: '📦 المنتجات',
    add: '➕ إضافة منتج',
    maincategories: '📁 الأقسام الرئيسية',
    subcategories: '📂 الأقسام الفرعية',
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

  /**
   * نفس منطق runLoader السابق في app.js — استدعاء دوال الرسم/التحميل حسب الصفحة
   */
  function runLegacyPageLoader(pageId) {
    var w = global;
    cpLog('load', pageId, 'start');
    try {
      var app = w.AdminApp;
      var migrated = {
        dashboard: app && app.dashboardPage,
        products: app && app.productsPage,
        maincategories: app && app.mainCategoriesPage,
        subcategories: app && app.subcategoriesPage,
        orders: app && app.ordersPage,
        reviews: app && app.reviewsPage,
        settings: app && app.settingsPage
      };
      var mod = migrated[pageId];
      if (mod && typeof mod.activate === 'function') {
        mod.activate();
      } else if (pageId === 'homepage') {
        var stSvc = w.AdminServices && w.AdminServices.settingsService;
        var storeApi = w.__adminStoreApi;
        var doneHome = function () {
          if (typeof w.renderHomepageSettings === 'function') w.renderHomepageSettings();
        };
        if (stSvc && storeApi && typeof stSvc.syncToStore === 'function') {
          stSvc.syncToStore(storeApi).finally(doneHome);
        } else {
          doneHome();
        }
      } else if (pageId === 'add' && typeof w.populateCategoryCheckboxes === 'function') {
        w.populateCategoryCheckboxes();
        if (typeof w.setProductFormWizardStep === 'function') {
          w.setProductFormWizardStep(1, { noScroll: true });
        }
      } else if (pageId === 'reports' && typeof w.renderReports === 'function') {
        w.renderReports();
      } else {
        cpLog('load', pageId, 'no handler (static or empty page)');
      }
    } catch (err) {
      if (typeof global.pharmaLogError === 'function') global.pharmaLogError('[CP-load]', err);
      else if (typeof console !== 'undefined' && console.error) console.error('[CP-load]', err);
    }
    cpLog('load', pageId, 'dispatched');
  }

  /**
   * @param {{ register: (name: string, mod: { mount?: Function, unmount?: Function }) => void }} opts
   */
  function createRouter(opts) {
    var routes = Object.create(null);
    var current = null;
    var currentName = null;

    function register(name, mod) {
      routes[name] = mod || {};
    }

    function switchVisibleSection(pageId) {
      var doc = global.document;
      var pages = doc.querySelectorAll('.content .page');
      for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('act');
        pages[i].style.display = '';
      }
      var pageEl = doc.getElementById('page-' + pageId);
      if (pageEl) {
        pageEl.classList.add('act');
      } else if (typeof console !== 'undefined' && console.warn) {
        console.warn('[CP] missing #page-' + pageId);
      }

      var titleEl = doc.getElementById('page-title');
      if (titleEl) {
        titleEl.textContent = PAGE_TITLES[pageId] || pageId;
      }

      var sbItems = doc.querySelectorAll('.sb-item');
      for (var j = 0; j < sbItems.length; j++) {
        sbItems[j].classList.remove('act');
      }
      var activeItem = doc.querySelector('.sb-item[data-page="' + pageId + '"]');
      if (activeItem) {
        activeItem.classList.add('act');
      }

      if (typeof global.closeSidebar === 'function') {
        global.closeSidebar();
      }
      global.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigate(name) {
      if (!name) return;
      var pageId = String(name);
      cpLog('nav', pageId, 'switch visible section');

      var next = routes[pageId];
      if (current && current.unmount) {
        try {
          current.unmount();
        } catch (e) {
          if (typeof console !== 'undefined' && console.error) console.error('[router] unmount', e);
        }
      }

      if (global._adminState && typeof global._adminState === 'object') {
        global._adminState.currentPage = pageId;
      }
      if (opts && opts.store && typeof opts.store.setCurrentPage === 'function') {
        opts.store.setCurrentPage(pageId);
      }

      switchVisibleSection(pageId);

      current = next || null;
      currentName = pageId;

      if (current && current.mount) {
        try {
          current.mount();
        } catch (e) {
          if (typeof console !== 'undefined' && console.error) console.error('[router] mount', e);
        }
      }

      runLegacyPageLoader(pageId);
    }

    function getCurrent() {
      return currentName;
    }

    return {
      register: register,
      navigate: navigate,
      getCurrent: getCurrent,
      runLegacyPageLoader: runLegacyPageLoader
    };
  }

  global.AdminRouter = {
    create: createRouter,
    PAGE_TITLES: PAGE_TITLES
  };
})(typeof window !== 'undefined' ? window : global);
