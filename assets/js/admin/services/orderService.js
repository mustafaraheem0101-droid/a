/**
 * orderService.js — طلبات الإدارة
 */
'use strict';

(function (global) {
  function getDeps() {
    return {
      adminFetch: global.adminFetch,
      apiIsSuccess: global.apiIsSuccess,
      apiErrorMessage: global.apiErrorMessage,
      coerceApiArray: global.coerceApiArray,
      normalizeOrderFromApi: global.normalizeOrderFromApi
    };
  }

  async function fetchAllAdmin() {
    var d = getDeps();
    try {
      var r = await d.adminFetch('admin_get_orders', {}, 'GET');
      if (d.apiIsSuccess(r) && r.data && r.data.orders) {
        var orders = d.coerceApiArray(r.data.orders).map(d.normalizeOrderFromApi);
        return { ok: true, orders: orders };
      }
      return { ok: false, message: d.apiErrorMessage(r) || 'فشل تحميل الطلبات' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function syncToStore(storeApi) {
    var res = await fetchAllAdmin();
    if (res.ok && res.orders && storeApi && typeof storeApi.setOrders === 'function') {
      storeApi.setOrders(res.orders);
    }
    return res;
  }

  async function updateStatus(id, status) {
    var d = getDeps();
    try {
      var r = await global.adminUpdateOrderStatus(id, status);
      return {
        ok: d.apiIsSuccess(r),
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function deleteOrder(id) {
    var d = getDeps();
    try {
      var r = await global.adminDeleteOrder(id);
      return {
        ok: d.apiIsSuccess(r),
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function createOrder(data) {
    var d = getDeps();
    try {
      var r = await global.adminCreateOrder(data);
      return {
        ok: d.apiIsSuccess(r),
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  global.AdminServices = global.AdminServices || {};
  global.AdminServices.orderService = {
    fetchAllAdmin: fetchAllAdmin,
    syncToStore: syncToStore,
    updateStatus: updateStatus,
    deleteOrder: deleteOrder,
    createOrder: createOrder
  };
})(typeof window !== 'undefined' ? window : global);
