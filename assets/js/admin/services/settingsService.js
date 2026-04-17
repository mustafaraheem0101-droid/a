/**
 * settingsService.js — إعدادات المتجر (إدارة)
 */
'use strict';

(function (global) {
  function getDeps() {
    return {
      adminFetch: global.adminFetch,
      apiIsSuccess: global.apiIsSuccess,
      apiErrorMessage: global.apiErrorMessage
    };
  }

  async function fetchSettings() {
    var d = getDeps();
    try {
      var r = await d.adminFetch('getSettings', {}, 'GET');
      if (d.apiIsSuccess(r) && r.data && r.data.settings) {
        return { ok: true, settings: r.data.settings };
      }
      return { ok: false, message: d.apiErrorMessage(r) || 'فشل تحميل الإعدادات' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function syncToStore(storeApi) {
    var res = await fetchSettings();
    if (res.ok && res.settings && storeApi && typeof storeApi.mergeSettings === 'function') {
      storeApi.mergeSettings(res.settings);
    } else if (res.ok && res.settings && storeApi && typeof storeApi.setSettings === 'function') {
      storeApi.setSettings(res.settings);
    }
    return res;
  }

  async function saveSettings(data) {
    var d = getDeps();
    try {
      var r = await global.adminSaveSettings(data);
      return {
        ok: d.apiIsSuccess(r),
        message: d.apiIsSuccess(r) ? '' : d.apiErrorMessage(r)
      };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  global.AdminServices = global.AdminServices || {};
  global.AdminServices.settingsService = {
    fetchSettings: fetchSettings,
    syncToStore: syncToStore,
    saveSettings: saveSettings
  };
})(typeof window !== 'undefined' ? window : global);
