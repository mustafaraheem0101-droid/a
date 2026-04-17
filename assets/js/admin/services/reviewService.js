/**
 * reviewService.js — تقييمات الإدارة
 */
'use strict';

(function (global) {
  function getDeps() {
    return {
      apiIsSuccess: global.apiIsSuccess,
      apiErrorMessage: global.apiErrorMessage,
      coerceApiArray: global.coerceApiArray
    };
  }

  async function fetchAll() {
    var d = getDeps();
    try {
      var list = await global.adminGetReviews();
      return { ok: true, reviews: d.coerceApiArray(list) };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e), reviews: [] };
    }
  }

  async function syncToStore(storeApi) {
    var res = await fetchAll();
    if (res.ok && storeApi && typeof storeApi.setReviews === 'function') {
      storeApi.setReviews(res.reviews || []);
    }
    return res;
  }

  async function saveReviews(reviews) {
    var d = getDeps();
    try {
      var r = await global.adminSaveReviews(reviews);
      return {
        ok: d.apiIsSuccess(r),
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  global.AdminServices = global.AdminServices || {};
  global.AdminServices.reviewService = {
    fetchAll: fetchAll,
    syncToStore: syncToStore,
    saveReviews: saveReviews
  };
})(typeof window !== 'undefined' ? window : global);
