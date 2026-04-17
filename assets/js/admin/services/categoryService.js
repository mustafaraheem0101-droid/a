/**
 * categoryService.js — الأقسام الرئيسية والفرعية (طبقة API)
 */
'use strict';

(function (global) {
  function getDeps() {
    return {
      adminFetch: global.adminFetch,
      apiIsSuccess: global.apiIsSuccess,
      apiErrorMessage: global.apiErrorMessage,
      coerceApiArray: global.coerceApiArray
    };
  }

  async function fetchMainCategoriesAdmin() {
    var d = getDeps();
    try {
      var r = await d.adminFetch('getCategories', { active: 0 }, 'GET');
      if (d.apiIsSuccess(r) && r.data && r.data.categories) {
        return { ok: true, categories: d.coerceApiArray(r.data.categories) };
      }
      return { ok: false, message: d.apiErrorMessage(r) || 'فشل تحميل الأقسام' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function fetchSubcategories() {
    var d = getDeps();
    try {
      var r = await d.adminFetch('getSubcategories', {}, 'GET');
      if (d.apiIsSuccess(r) && r.data && r.data.subcategories) {
        return { ok: true, subcategories: d.coerceApiArray(r.data.subcategories) };
      }
      return { ok: false, message: d.apiErrorMessage(r) || 'فشل تحميل الأقسام الفرعية' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function syncMainToStore(storeApi) {
    var res = await fetchMainCategoriesAdmin();
    if (res.ok && res.categories && storeApi && typeof storeApi.setCategories === 'function') {
      storeApi.setCategories(res.categories);
    }
    return res;
  }

  async function syncSubToStore(storeApi) {
    var res = await fetchSubcategories();
    if (res.ok && res.subcategories && storeApi && typeof storeApi.setSubcategories === 'function') {
      storeApi.setSubcategories(res.subcategories);
    }
    return res;
  }

  async function saveSubcategoryAdmin(sub) {
    var d = getDeps();
    if (!sub || !sub.name || !sub.parent) {
      return { ok: false, message: 'الاسم والقسم الرئيسي مطلوبان' };
    }
    try {
      var action = sub.id ? 'updateSubcategory' : 'addSubcategory';
      var r = await d.adminFetch(action, { subcategory: sub });
      if (d.apiIsSuccess(r)) return { ok: true };
      return { ok: false, message: d.apiErrorMessage(r) || 'تعذر حفظ القسم الفرعي' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function deleteSubcategoryAdmin(id) {
    var d = getDeps();
    if (id == null || id === '') {
      return { ok: false, message: 'معرف غير صالح' };
    }
    try {
      var r = await d.adminFetch('deleteSubcategory', { id: id });
      if (d.apiIsSuccess(r)) return { ok: true };
      return { ok: false, message: d.apiErrorMessage(r) || 'تعذر الحذف' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  global.AdminServices = global.AdminServices || {};
  global.AdminServices.categoryService = {
    fetchMainCategoriesAdmin: fetchMainCategoriesAdmin,
    fetchSubcategories: fetchSubcategories,
    syncMainToStore: syncMainToStore,
    syncSubToStore: syncSubToStore,
    saveSubcategoryAdmin: saveSubcategoryAdmin,
    deleteSubcategoryAdmin: deleteSubcategoryAdmin
  };
})(typeof window !== 'undefined' ? window : global);
