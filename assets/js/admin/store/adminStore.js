/**
 * adminStore.js — حالة لوحة التحكم المركزية (اشتراك + دوال تحكم)
 * يُنشئ كائن الحالة نفسه المعرَّف كـ window._adminState للتوافق مع admin.js الحالي.
 */
'use strict';

(function (global) {
  /**
   * @returns {{
   *   getState: () => Object,
   *   subscribe: (fn: (hint?: string) => void) => () => void,
   *   setCurrentPage: (id: string) => void,
   *   setProducts: (arr: unknown[]) => void,
   *   setCategories: (arr: unknown[]) => void,
   *   setSubcategories: (arr: unknown[]) => void,
   *   setOrders: (arr: unknown[]) => void,
   *   setSettings: (s: object) => void,
   *   notify: (hint?: string) => void
   * }}
   */
  function createAdminStore() {
    const state = {
      products: [],
      categories: [],
      subcategories: [],
      orders: [],
      reviews: [],
      settings: {},
      currentPage: 'dashboard',
      selectedProducts: new Set(),
      selectedMainCats: new Set(),
      selectedSubcats: new Set(),
      productsDirty: false,
      loadErrors: [],
      productListFilter: {
        search: '',
        cat: '',
        subcat: '',
        status: '',
        stock: '',
        priceMin: '',
        priceMax: '',
        sort: 'newest'
      }
    };

    const listeners = new Set();

    function notify(hint) {
      listeners.forEach(function (fn) {
        try {
          fn(hint);
        } catch (e) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[adminStore] subscriber', e);
          }
        }
      });
    }

    return {
      getState: function () {
        return state;
      },

      subscribe: function (fn) {
        listeners.add(fn);
        return function () {
          listeners.delete(fn);
        };
      },

      setCurrentPage: function (id) {
        state.currentPage = id || 'dashboard';
        notify('currentPage');
      },

      setProducts: function (arr) {
        state.products = Array.isArray(arr) ? arr : [];
        notify('products');
      },

      setCategories: function (arr) {
        state.categories = Array.isArray(arr) ? arr : [];
        notify('categories');
      },

      setSubcategories: function (arr) {
        state.subcategories = Array.isArray(arr) ? arr : [];
        notify('subcategories');
      },

      setOrders: function (arr) {
        state.orders = Array.isArray(arr) ? arr : [];
        notify('orders');
      },

      setSettings: function (s) {
        state.settings = s && typeof s === 'object' ? s : {};
        notify('settings');
      },

      mergeSettings: function (partial) {
        if (!partial || typeof partial !== 'object') return;
        Object.assign(state.settings, partial);
        notify('settings');
      },

      setReviews: function (arr) {
        state.reviews = Array.isArray(arr) ? arr : [];
        notify('reviews');
      },

      patchOrder: function (id, patch) {
        var list = state.orders || [];
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].id) === String(id)) {
            list[i] = Object.assign({}, list[i], patch);
            notify('orders');
            return;
          }
        }
      },

      removeOrder: function (id) {
        state.orders = (state.orders || []).filter(function (o) {
          return String(o.id) !== String(id);
        });
        notify('orders');
      },

      toggleMainCatSelection: function (id) {
        if (id == null) return;
        var k = String(id);
        if (state.selectedMainCats.has(k)) state.selectedMainCats.delete(k);
        else state.selectedMainCats.add(k);
        notify('mainCatSelection');
      },

      clearMainCatSelections: function () {
        state.selectedMainCats.clear();
        notify('mainCatSelection');
      },

      toggleSubcatSelection: function (id) {
        if (id == null) return;
        var k = String(id);
        if (state.selectedSubcats.has(k)) state.selectedSubcats.delete(k);
        else state.selectedSubcats.add(k);
        notify('subcatSelection');
      },

      clearSubcatSelections: function () {
        state.selectedSubcats.clear();
        notify('subcatSelection');
      },

      patchProductListFilter: function (partial) {
        if (!partial || typeof partial !== 'object') return;
        var f = state.productListFilter;
        Object.keys(partial).forEach(function (k) {
          f[k] = partial[k];
        });
        notify('productListFilter');
      },

      resetProductListFilter: function () {
        var f = state.productListFilter;
        f.search = '';
        f.cat = '';
        f.subcat = '';
        f.status = '';
        f.stock = '';
        f.priceMin = '';
        f.priceMax = '';
        f.sort = 'newest';
        notify('productListFilter');
      },

      patchProduct: function (id, patch) {
        var list = state.products;
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].id) === String(id)) {
            list[i] = Object.assign({}, list[i], patch);
            notify('products');
            return;
          }
        }
      },

      removeProduct: function (id) {
        state.products = (state.products || []).filter(function (p) {
          return String(p.id) !== String(id);
        });
        var rm = [];
        state.selectedProducts.forEach(function (x) {
          if (String(x) === String(id)) rm.push(x);
        });
        rm.forEach(function (x) {
          state.selectedProducts.delete(x);
        });
        notify('products');
      },

      selectAllVisibleProducts: function (productRows) {
        state.selectedProducts.clear();
        (productRows || []).forEach(function (p) {
          state.selectedProducts.add(String(p.id));
        });
        notify('selection');
      },

      toggleSelectedProduct: function (id) {
        var k = String(id);
        if (state.selectedProducts.has(k)) state.selectedProducts.delete(k);
        else state.selectedProducts.add(k);
        notify('selection');
      },

      clearSelectedProducts: function () {
        state.selectedProducts.clear();
        notify('selection');
      },

      /** لاستدعاء يدوي بعد تحديثات عبر كود قديم يعدّل state مباشرة */
      notify: notify
    };
  }

  global.AdminStore = { create: createAdminStore };
})(typeof window !== 'undefined' ? window : global);
