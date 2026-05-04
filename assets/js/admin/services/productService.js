/**
 * productService.js — طبقة API للمنتجات (بدون استدعاء adminFetch من واجهة الصفحة)
 */
'use strict';

(function (global) {
  function getDeps() {
    return {
      adminFetch: global.adminFetch,
      apiIsSuccess: global.apiIsSuccess,
      apiErrorMessage: global.apiErrorMessage,
      coerceApiArray: global.coerceApiArray,
      normalizeProductFromApi: global.normalizeProductFromApi
    };
  }

  /**
   * جلب كل المنتجات (بما فيها غير النشطة) لاستخدام الإدارة
   * @returns {Promise<{ ok: boolean, products?: unknown[], message?: string }>}
   */
  async function fetchAllAdmin() {
    const d = getDeps();
    try {
      const pick =
        typeof global.pickAdminProductsFromData === 'function'
          ? global.pickAdminProductsFromData
          : function (x) {
              return x && x.products ? x.products : [];
            };
      const r = await d.adminFetch('getProducts', { active: 0 }, 'GET', { timeoutMs: 90000 });
      if (d.apiIsSuccess(r) && r.data && typeof r.data === 'object') {
        const raw = pick(r.data);
        const products = d.coerceApiArray(raw).map(d.normalizeProductFromApi);
        return { ok: true, products: products };
      }
      return { ok: false, message: d.apiErrorMessage(r) || 'فشل تحميل المنتجات' };
    } catch (e) {
      var msg = e && e.name === 'AbortError' ? 'انتهت مهلة تحميل المنتجات' : (e && e.message ? e.message : String(e));
      return { ok: false, message: msg };
    }
  }

  /**
   * مزامنة الحالة من الخادم ثم تمرير النتيجة لـ onSuccess
   */
  async function syncToStore(storeApi) {
    const res = await fetchAllAdmin();
    if (res.ok && res.products && storeApi && typeof storeApi.setProducts === 'function') {
      storeApi.setProducts(res.products);
    }
    return res;
  }

  async function deleteProduct(id) {
    const d = getDeps();
    try {
      const r = await global.adminDeleteProduct(id);
      return {
        ok: d.apiIsSuccess(r),
        res: r,
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function toggleProduct(id, active) {
    const d = getDeps();
    try {
      const r = await global.adminToggleProduct(id, active);
      return {
        ok: d.apiIsSuccess(r),
        res: r,
        message: d.apiIsSuccess(r) ? (r && r.message ? r.message : '') : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function clearAllProducts() {
    const d = getDeps();
    try {
      const r = await global.adminFetch('clear_all_products');
      return {
        ok: d.apiIsSuccess(r),
        res: r,
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function clearMaterialPricingData(opts) {
    const d = getDeps();
    const o = opts && typeof opts === 'object' ? opts : {};
    try {
      const fn = global.adminClearProductMaterialData;
      const r =
        typeof fn === 'function'
          ? await fn({ zeroSellingPrices: !!o.zeroSellingPrices })
          : await global.adminFetch('clear_product_material_data', {
              zero_selling_prices: !!o.zeroSellingPrices
            });
      return {
        ok: d.apiIsSuccess(r),
        res: r,
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  global.AdminServices = global.AdminServices || {};
  global.AdminServices.productService = {
    fetchAllAdmin: fetchAllAdmin,
    syncToStore: syncToStore,
    deleteProduct: deleteProduct,
    toggleProduct: toggleProduct,
    clearAllProducts: clearAllProducts,
    clearMaterialPricingData: clearMaterialPricingData
  };
})(typeof window !== 'undefined' ? window : global);
