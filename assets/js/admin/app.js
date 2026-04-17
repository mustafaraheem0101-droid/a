/**
 * app.js (لوحة التحكم) — تهيئة المتجر + الموجّه + تسجيل الصفحات
 * يجب تحميله بعد: utils.js, api.js, adminStore, services, pages, router
 * وقبل: admin.js (لتعريف window._adminState من المتجر)
 */
'use strict';

(function (global) {
  if (!global.AdminStore || !global.AdminRouter || !global.AdminPages || !global.AdminServices) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[AdminApp] missing modules — skipping architecture bootstrap');
    }
    return;
  }

  var store = global.AdminStore.create();
  global.__adminStoreApi = store;
  global._adminState = store.getState();

  var productService = global.AdminServices.productService;
  var categoryService = global.AdminServices.categoryService;
  var orderService = global.AdminServices.orderService;
  var reviewService = global.AdminServices.reviewService;
  var settingsService = global.AdminServices.settingsService;

  var productsPage = global.AdminPages.createProductsPage({
    store: store,
    productService: productService
  });

  var dashboardPage = global.AdminPages.createDashboardPage({ store: store });
  var mainCategoriesPage = global.AdminPages.createMainCategoriesPage({
    store: store,
    categoryService: categoryService
  });
  var subcategoriesPage = global.AdminPages.createSubcategoriesPage({
    store: store,
    categoryService: categoryService
  });
  var ordersPage = global.AdminPages.createOrdersPage({
    store: store,
    orderService: orderService
  });
  var reviewsPage = global.AdminPages.createReviewsPage({
    store: store,
    reviewService: reviewService
  });
  var settingsPage = global.AdminPages.createSettingsPage({
    store: store,
    settingsService: settingsService
  });

  var router = global.AdminRouter.create({ store: store });

  var noop = function () {};

  var ROUTE_NAMES = [
    'dashboard',
    'products',
    'add',
    'maincategories',
    'subcategories',
    'orders',
    'reviews',
    'homepage',
    'settings',
    'backup',
    'reports',
    'activitylog'
  ];

  var routeModules = {
    dashboard: dashboardPage,
    products: productsPage,
    maincategories: mainCategoriesPage,
    subcategories: subcategoriesPage,
    orders: ordersPage,
    reviews: reviewsPage,
    settings: settingsPage
  };

  ROUTE_NAMES.forEach(function (name) {
    var mod = routeModules[name];
    if (mod) {
      router.register(name, {
        mount: mod.mount,
        unmount: mod.unmount
      });
    } else {
      router.register(name, { mount: noop, unmount: noop });
    }
  });

  function showPage(name) {
    router.navigate(name);
  }

  global.showPage = showPage;
  global.__ADMIN_ROUTER__ = router;

  /**
   * تحديث المنتجات في المتجر وإعادة الرسم — للاستدعاء من سكربتات خارجية أو اختبارات
   */
  global.renderProducts = function (products) {
    var arr = global.coerceApiArray ? global.coerceApiArray(products) : [].concat(products || []);
    if (global.normalizeProductFromApi) {
      arr = arr.map(global.normalizeProductFromApi);
    }
    if (global.__adminStoreApi && typeof global.__adminStoreApi.setProducts === 'function') {
      global.__adminStoreApi.setProducts(arr);
    }
    if (productsPage && typeof productsPage.render === 'function') {
      try {
        productsPage.render();
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) console.error('[renderProducts]', e);
      }
    }
  };

  global.AdminApp = {
    store: store,
    router: router,
    productsPage: productsPage,
    dashboardPage: dashboardPage,
    mainCategoriesPage: mainCategoriesPage,
    subcategoriesPage: subcategoriesPage,
    ordersPage: ordersPage,
    reviewsPage: reviewsPage,
    settingsPage: settingsPage,
    productService: productService,
    categoryService: categoryService,
    orderService: orderService,
    reviewService: reviewService,
    settingsService: settingsService
  };
})(typeof window !== 'undefined' ? window : global);
